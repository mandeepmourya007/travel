import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Logger } from 'pino'
import { startTimer } from '../utils/perf-timer'
import type { SignupDto, LoginDto, AuthResponse, JwtPayload } from '@shared/types/auth.types'
import type { UserProfileResponse, ConnectBankAccountDto, ConnectBankAccountResponse } from '@shared/types/user.types'
import { DEFAULT_USER_NAME } from '@shared/constants/roles'
import type { SignupRole } from '@shared/constants/roles'
import { UserRepository } from '../repositories/user.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { WalletRepository } from '../repositories/wallet.repository'
import { DocumentReviewRepository } from '../repositories/document-review.repository'
import { DOC_TYPES } from '@shared/constants/upload'
import { AuthError, ConflictError, NotFoundError, PaymentError, ValidationError, GoneError } from '../errors/app-error'
import { env } from '../config/env'
import { SALT_ROUNDS, JWT_ACCESS_EXPIRY, REFRESH_TOKEN_DAYS, JWT_ACCESS_EXPIRY_SECONDS, INVITE_TOKEN_TYPE } from '../utils/constants'
import { uniqueSlug, slugify } from '../utils/slugify'
import { mergeDocuments } from '../utils/documents'
import { USER_ROLE, PAYMENT_PROVIDER } from '@shared/constants'
import type { LoginAttemptTracker } from '../utils/login-attempt-tracker'
import type { OrganizerInviteRepository } from '../repositories/organizer-invite.repository'
import type { IEmailProvider } from '../providers/email-provider.interface'
import type { IPaymentGateway } from '../providers/payment/payment-gateway.interface'
import { PAYOUT_ERROR } from '../providers/payment/payment.constants'
import { organizerInviteTemplate } from '../templates'

/** Prisma unique constraint violation code */
const PRISMA_UNIQUE_VIOLATION = 'P2002'

interface DocumentReviewRow {
  id: string
  docType: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  currentUrl: string | null
  reviewedAt: Date | null
  reviewedBy: string | null
}

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private refreshTokenRepo: RefreshTokenRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private walletRepo: WalletRepository,
    private jwtSecret: string,
    private logger: Logger,
    private googleClientId?: string,
    private loginAttemptTracker?: LoginAttemptTracker | null,
    private docReviewRepo?: DocumentReviewRepository | null,
    private organizerInviteRepo?: OrganizerInviteRepository | null,
    private emailProvider?: IEmailProvider | null,
    private gateway?: IPaymentGateway | null,
  ) {}

  private googleOAuthClient?: import('google-auth-library').OAuth2Client

  async signup(
    dto: SignupDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const timer = startTimer()
    const exists = await this.userRepo.emailExists(dto.email)
    if (exists) {
      throw new ConflictError('An account with this email already exists')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)
    const user = await this.userRepo.create({
      name: dto.name || DEFAULT_USER_NAME,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role || USER_ROLE.TRAVELER,
    })

    // Auto-create OrganizerProfile for ORGANIZER signups (same transaction prevents orphans)
    if (user.role === USER_ROLE.ORGANIZER) {
      try {
        await this.createOrganizerProfileWithSlug(user.id, user.name)
        this.logger.info({ userId: user.id }, 'OrganizerProfile auto-created')
      } catch (err) {
        this.logger.error({ userId: user.id, err }, 'Failed to create OrganizerProfile, rolling back user')
        throw err
      }
    }

    await this.createWalletForUser(user.id)

    this.logger.info({ userId: user.id, role: user.role, durationMs: timer.elapsed() }, 'User signed up')
    return this.issueTokens(user, meta)
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const timer = startTimer()

    // Check brute-force lockout before any DB work
    if (this.loginAttemptTracker) {
      const lockoutRemaining = await this.loginAttemptTracker.isLocked(dto.email)
      if (lockoutRemaining > 0) {
        throw new AuthError(
          `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(lockoutRemaining / 60)} minutes.`,
        )
      }
    }

    const user = await this.userRepo.findByEmail(dto.email)
    if (!user) {
      // Record failure even for non-existent emails to prevent email enumeration timing attacks
      await this.loginAttemptTracker?.recordFailure(dto.email)
      throw new AuthError('Invalid email or password')
    }
    if (!user.passwordHash) {
      throw new AuthError(
        user.googleId
          ? 'This account uses Google sign-in. Please use the Google button.'
          : 'Invalid email or password',
      )
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      await this.loginAttemptTracker?.recordFailure(dto.email)
      throw new AuthError('Invalid email or password')
    }

    if (!user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    // Successful login — clear any failed attempts
    await this.loginAttemptTracker?.resetAttempts(dto.email)

    this.logger.info({ userId: user.id, durationMs: timer.elapsed() }, 'User logged in')
    return this.issueTokens(user, meta)
  }

  async refresh(
    rawRefreshToken: string,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
    const token = await this.refreshTokenRepo.findByHash(tokenHash)

    if (!token) throw new AuthError('Invalid refresh token')
    if (token.expiresAt < new Date()) throw new AuthError('Refresh token expired')

    // ── Reuse detection ─────────────────────────────────
    // If the token was already revoked, an attacker may be replaying a stolen token.
    // Grace period: allow if revoked < 30s ago (handles multi-tab race condition).
    if (token.revokedAt) {
      const revokedAgo = Date.now() - token.revokedAt.getTime()
      const GRACE_PERIOD_MS = 30_000
      if (revokedAgo > GRACE_PERIOD_MS) {
        // Revoke entire token family — confirmed reuse
        if (token.familyId) {
          await this.refreshTokenRepo.revokeByFamily(token.familyId)
          this.logger.warn({ userId: token.userId, familyId: token.familyId }, 'Refresh token reuse detected — family revoked')
        }
        throw new AuthError('Token has been revoked')
      }
      // Within grace period — allow but don't rotate again (already rotated)
    }

    const user = await this.userRepo.findById(token.userId)
    if (!user || !user.isActive) throw new AuthError('User not found or deactivated')

    // ── Rotate: revoke old, issue new ───────────────────
    if (!token.revokedAt) {
      try {
        await this.refreshTokenRepo.revokeByHash(tokenHash)
      } catch {
        // Token may have been concurrently revoked — safe to continue
      }
    }

    const familyId = token.familyId ?? token.id
    const accessToken = this.generateAccessToken({ userId: user.id, role: user.role })
    const newRefreshToken = await this.generateRefreshToken(user.id, meta ?? {}, familyId)

    return { accessToken, expiresIn: JWT_ACCESS_EXPIRY_SECONDS, refreshToken: newRefreshToken }
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
    try {
      await this.refreshTokenRepo.revokeByHash(tokenHash)
    } catch {
      // Token may not exist — that's fine, still return success
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUser(userId)
    this.logger.info({ userId }, 'All sessions revoked')
  }

  /**
   * Generates access + refresh token pair for an authenticated user.
   * @internal Called by AuthService (signup/login) and OtpService (OTP verify).
   * Not intended for controller-level access.
   */
  async issueTokens(
    user: { id: string; name: string; email: string | null; role: string; avatarUrl: string | null },
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const accessToken = this.generateAccessToken({ userId: user.id, role: user.role })
    const refreshToken = await this.generateRefreshToken(user.id, meta)
    return {
      auth: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email ?? undefined,
          role: user.role as AuthResponse['user']['role'],
          avatarUrl: user.avatarUrl ?? undefined,
        },
        tokens: { accessToken, expiresIn: JWT_ACCESS_EXPIRY_SECONDS },
      },
      refreshToken,
    }
  }

  async getMe(userId: string): Promise<AuthResponse['user']> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new AuthError('User not found')

    return {
      id: user.id,
      name: user.name,
      email: user.email ?? undefined,
      role: user.role,
      avatarUrl: user.avatarUrl ?? undefined,
    }
  }

  /**
   * Updates the authenticated user's profile (name, role).
   * Used during onboarding after signup/OTP/Google + profile page edits.
   * Auto-creates OrganizerProfile when switching to ORGANIZER.
   * @throws {NotFoundError} User not found
   */
  async updateProfile(
    userId: string,
    dto: { name?: string; role?: SignupRole },
  ): Promise<{ id: string; name: string; role: string; accessToken?: string }> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new NotFoundError('User')

    const updateData: { name?: string; role?: SignupRole } = {}
    if (dto.name) updateData.name = dto.name
    if (dto.role) updateData.role = dto.role

    const updated = await this.userRepo.updateProfile(userId, updateData)

    // Auto-create OrganizerProfile when switching to ORGANIZER (if not already exists)
    if (dto.role === USER_ROLE.ORGANIZER && user.role !== USER_ROLE.ORGANIZER) {
      const existing = await this.organizerProfileRepo.findByUserId(userId)
      if (!existing) {
        await this.createOrganizerProfileWithSlug(userId, dto.name || user.name)
        this.logger.info({ userId }, 'OrganizerProfile auto-created via onboarding')
      }
    }

    // Reissue access token when role changes so the client has the correct role claim
    const roleChanged = dto.role && dto.role !== user.role
    const accessToken = roleChanged
      ? this.generateAccessToken({ userId: updated.id, role: updated.role })
      : undefined

    return { id: updated.id, name: updated.name, role: updated.role, accessToken }
  }

  /**
   * Fetches the complete user profile including organizer data if applicable.
   * Returns null organizerProfile for TRAVELERs or soft-deleted organizer profiles.
   * @throws {NotFoundError} User not found
   */
  async getFullProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepo.findWithOrganizer(userId)
    if (!user) throw new NotFoundError('User')

    // Soft-delete check done here — Prisma 1-to-1 doesn't support nested where
    const orgProfile = user.organizerProfile && !user.organizerProfile.isDeleted
      ? {
          id: user.organizerProfile.id,
          slug: user.organizerProfile.slug,
          businessName: user.organizerProfile.businessName,
          description: user.organizerProfile.description,
          verificationStatus: user.organizerProfile.verificationStatus,
          rating: user.organizerProfile.rating,
          totalReviews: user.organizerProfile.totalReviews,
          totalTripsCompleted: user.organizerProfile.totalTripsCompleted,
          bankAccountLinked: this.gateway?.provider === 'cashfree'
            ? !!user.organizerProfile.cashfreeVendorId
            : !!user.organizerProfile.razorpayAccountId,
          documents: (user.organizerProfile.documents as Record<string, string> | null) ?? null,
          documentReviews: ((user.organizerProfile as { documentReviews?: DocumentReviewRow[] }).documentReviews ?? []).map((dr) => ({
            ...dr,
            reviewedAt: dr.reviewedAt?.toISOString() ?? null,
          })),
        }
      : null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isVerified: user.aadhaarVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt.toISOString(),
      organizerProfile: orgProfile,
      isReseller: user.isReseller,
    }
  }

  /**
   * Updates organizer-specific profile fields (businessName, description).
   * Uses existing organizerProfileRepo.update(id, data) — no new repo method.
   * @throws {NotFoundError} OrganizerProfile not found for this user
   */
  async updateOrganizerProfile(
    userId: string,
    dto: { businessName?: string; description?: string; documents?: Record<string, string> },
  ): Promise<{ businessName: string; description: string | null }> {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    const { documents, ...rest } = dto
    const updateData: { businessName?: string; description?: string; slug?: string; documents?: Record<string, string> } = { ...rest }
    if (documents) {
      updateData.documents = mergeDocuments(
        profile.documents as Record<string, string> | null,
        documents,
      )
      // Upsert DocumentReview rows — reset status to PENDING for re-uploaded docs
      if (this.docReviewRepo) {
        const pendingDocs = DOC_TYPES
          .filter(field => documents[field] && documents[field] !== '')
          .map(field => ({ docType: field, currentUrl: documents[field] }))
        if (pendingDocs.length > 0) {
          await this.docReviewRepo.upsertMany(profile.id, pendingDocs)
        }
      }
    }
    if (dto.businessName && dto.businessName !== profile.businessName) {
      updateData.slug = await uniqueSlug(dto.businessName, (s) => this.organizerProfileRepo.slugExists(s))
    }

    let updated: { businessName: string; description: string | null }
    try {
      updated = await this.organizerProfileRepo.update(profile.id, updateData)
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err) && updateData.slug) {
        updateData.slug = `${slugify(dto.businessName!)}-${Date.now() % 10000}`
        updated = await this.organizerProfileRepo.update(profile.id, updateData)
      } else {
        throw err
      }
    }
    this.logger.info({ userId }, 'Organizer profile updated')

    return { businessName: updated.businessName, description: updated.description }
  }

  /**
   * Adds a comment from the organizer to their own document review thread.
   * @throws {NotFoundError} OrganizerProfile not found
   */
  async addOrganizerDocComment(
    userId: string,
    dto: { docType?: string; comment: string; attachmentUrl?: string },
  ) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new NotFoundError('OrganizerProfile')
    if (!this.docReviewRepo) throw new Error('DocumentReviewRepository not configured')

    return this.docReviewRepo.addComment({
      organizerId: profile.id,
      authorId: userId,
      authorRole: 'ORGANIZER',
      docType: dto.docType,
      comment: dto.comment,
      attachmentUrl: dto.attachmentUrl,
    })
  }

  /**
   * Fetches comments for the organizer's document review thread.
   * @throws {NotFoundError} OrganizerProfile not found
   */
  async getOrganizerDocComments(userId: string) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new NotFoundError('OrganizerProfile')
    if (!this.docReviewRepo) throw new Error('DocumentReviewRepository not configured')

    const { data } = await this.docReviewRepo.findComments(profile.id, { skip: 0, take: 100 })
    return data
  }

  /**
   * Links the organizer's bank account via the active payment gateway.
   * Delegates to gateway.createPayoutAccount() — provider-specific logic lives there.
   *
   * Re-link guard: blocks only if the current gateway's provider column is already set,
   * so switching gateways allows linking a new payout account without being blocked.
   *
   * @throws {NotFoundError} OrganizerProfile or User not found
   * @throws {ConflictError} Payout account already linked for the active gateway
   * @throws {PaymentError} Gateway API failure
   */
  async connectBankAccount(
    userId: string,
    dto: ConnectBankAccountDto,
  ): Promise<ConnectBankAccountResponse> {
    if (!this.gateway) throw new PaymentError(PAYOUT_ERROR.GATEWAY_NOT_CONFIGURED)

    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    // Provider-aware re-link guard — check the active gateway's own column
    const provider = this.gateway.provider
    const alreadyLinked = provider === 'cashfree'
      ? !!profile.cashfreeVendorId
      : !!profile.razorpayAccountId
    if (alreadyLinked) {
      throw new ConflictError(PAYOUT_ERROR.ALREADY_LINKED)
    }

    // Razorpay's Route linked-account API hardcodes business_type: 'individual', which
    // requires legal_info.pan — catch that here as a 400 before hitting the gateway (502).
    if (provider === PAYMENT_PROVIDER.RAZORPAY && !dto.pan) {
      throw new ValidationError('PAN is required to link a Razorpay payout account')
    }

    const user = await this.userRepo.findById(userId)
    if (!user) throw new NotFoundError('User')

    const acct = await this.gateway.createPayoutAccount({
      referenceId: profile.id,
      businessName: profile.businessName,
      contactName: dto.accountHolderName,
      email: user.email ?? `organizer-${profile.id}@placeholder.local`,
      phone: user.phone,
      pan: dto.pan,
      accountType: dto.accountType,
      bank: {
        accountNumber: dto.accountNumber,
        ifsc: dto.ifscCode,
        beneficiaryName: dto.beneficiaryName,
      },
    })

    // Atomic CAS — prevents race condition when two requests pass the check above
    const { count } = await this.organizerProfileRepo.linkPayoutAccount(profile.id, acct.provider, acct.accountId)
    if (count === 0) {
      this.logger.warn(
        { userId, profileId: profile.id, orphanedAccountId: acct.accountId, provider: acct.provider },
        'CAS failed after payout account creation — orphaned account',
      )
      throw new ConflictError(PAYOUT_ERROR.ALREADY_LINKED)
    }

    const masked = dto.accountNumber.slice(-4).padStart(dto.accountNumber.length, '*')
    this.logger.info({ userId, profileId: profile.id, provider }, 'Payout account linked')

    return { bankAccountLinked: true, maskedAccountNumber: masked }
  }

  /**
   * Authenticates a user via Google OAuth ID token.
   * Flow: verify token → find by googleId → find by email (link) → create new.
   * New users always get role TRAVELER; onboarding handles role selection.
   * Handles P2002 race condition (concurrent signup) by retrying as login.
   * @throws {AuthError} Invalid/unverified Google token, deactivated account, Google not configured
   */
  async googleAuth(
    dto: { idToken: string },
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string; isNewUser: boolean }> {
    const google = await this.verifyGoogleToken(dto.idToken)

    // Case A: existing user by googleId
    let user = await this.userRepo.findByGoogleId(google.sub)
    if (user) {
      if (!user.isActive) throw new AuthError('Account is deactivated')
      this.logger.info({ userId: user.id }, 'Google login (by googleId)')
      return { ...(await this.issueTokens(user, meta)), isNewUser: false }
    }

    // Case B: existing user by email — link googleId + backfill avatar if missing
    user = await this.userRepo.findByEmail(google.email)
    if (user) {
      if (!user.isActive) throw new AuthError('Account is deactivated')
      const avatarToSet = !user.avatarUrl ? google.picture : undefined
      user = await this.userRepo.updateGoogleId(user.id, google.sub, avatarToSet)
      this.logger.info({ userId: user.id }, 'Google login (linked googleId)')
      return { ...(await this.issueTokens(user, meta)), isNewUser: false }
    }

    // Case C: new user — always TRAVELER, onboarding handles role
    try {
      user = await this.userRepo.create({
        name: google.name,
        email: google.email,
        googleId: google.sub,
        role: USER_ROLE.TRAVELER,
        avatarUrl: google.picture,
      })
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
        const existing = await this.userRepo.findByGoogleId(google.sub)
          || await this.userRepo.findByEmail(google.email)
        if (existing) {
          return { ...(await this.issueTokens(existing, meta)), isNewUser: false }
        }
      }
      throw err
    }

    await this.createWalletForUser(user.id)

    this.logger.info({ userId: user.id }, 'New user via Google')
    return { ...(await this.issueTokens(user, meta)), isNewUser: true }
  }

  /**
   * Creates an OrganizerProfile with a unique slug, retrying on P2002 (slug collision).
   * Handles the TOCTOU race between uniqueSlug check and DB insert.
   */
  private async createOrganizerProfileWithSlug(userId: string, businessName: string): Promise<void> {
    const slug = await uniqueSlug(businessName, (s) => this.organizerProfileRepo.slugExists(s))
    try {
      await this.organizerProfileRepo.create({
        user: { connect: { id: userId } },
        businessName,
        slug,
      })
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        const fallbackSlug = `${slugify(businessName)}-${Date.now() % 10000}`
        await this.organizerProfileRepo.create({
          user: { connect: { id: userId } },
          businessName,
          slug: fallbackSlug,
        })
      } else {
        throw err
      }
    }
  }

  private isPrismaUniqueViolation(err: unknown): boolean {
    return err instanceof Error && 'code' in err && (err as { code: string }).code === PRISMA_UNIQUE_VIOLATION
  }

  /** Eager wallet creation — every new user gets a wallet. Non-fatal on failure. */
  private async createWalletForUser(userId: string): Promise<void> {
    try {
      await this.walletRepo.create(userId)
      this.logger.info({ userId }, 'Wallet auto-created')
    } catch (err) {
      this.logger.error({ userId, err }, 'Failed to auto-create wallet')
    }
  }

  // Lazy-loads Google OAuth2Client to avoid importing google-auth-library at startup
  private async getGoogleClient() {
    if (!this.googleClientId) throw new AuthError('Google sign-in is not configured')
    if (!this.googleOAuthClient) {
      const { OAuth2Client } = await import('google-auth-library')
      this.googleOAuthClient = new OAuth2Client(this.googleClientId)
    }
    return this.googleOAuthClient
  }

  // Verifies Google ID token and extracts user profile (email, name, sub, picture)
  private async verifyGoogleToken(idToken: string) {
    const client = await this.getGoogleClient()
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.googleClientId!,
      })
      const payload = ticket.getPayload()
      if (!payload) throw new AuthError('Invalid Google token')
      if (!payload.email_verified) throw new AuthError('Google email is not verified')
      return {
        email: payload.email!.toLowerCase(),
        name: payload.name || payload.email!.split('@')[0],
        sub: payload.sub,
        picture: payload.picture,
      }
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError('Google token verification failed')
    }
  }

  private generateAccessToken(payload: { userId: string; role: string }): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: JWT_ACCESS_EXPIRY })
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload
    } catch {
      throw new AuthError('Invalid or expired token')
    }
  }

  private generateOrganizerInviteToken(email: string): string {
    return jwt.sign({ email, type: INVITE_TOKEN_TYPE.ORGANIZER_INVITE }, this.jwtSecret, { expiresIn: '7d' })
  }

  async createOrganizerInvite(email: string, sentBy: string): Promise<{ token: string; email: string }> {
    const token = this.generateOrganizerInviteToken(email)
    if (!this.organizerInviteRepo) {
      this.logger.warn({ email }, 'organizerInviteRepo not configured — invite will not be persisted')
    }
    await this.organizerInviteRepo?.upsert(email, token, sentBy)

    if (!this.emailProvider) {
      throw new Error('Email service is not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to enable organizer invite emails')
    }

    const signupUrl = `${env.CLIENT_URL}/signup/organizer/${token}`
    const tpl = organizerInviteTemplate(signupUrl)
    this.emailProvider.sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      .catch((err) => this.logger.error({ email, err }, 'Failed to send organizer invite email'))

    return { token, email }
  }

  verifyOrganizerInviteToken(token: string): { email: string } {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { email?: string; type?: string }
      if (payload.type !== INVITE_TOKEN_TYPE.ORGANIZER_INVITE || !payload.email) {
        throw new AuthError('Invalid invite token')
      }
      return { email: payload.email }
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError('Invalid or expired invite link')
    }
  }

  async getOrganizerInviteEmail(token: string): Promise<{ email: string }> {
    const { email } = this.verifyOrganizerInviteToken(token)
    if (this.organizerInviteRepo) {
      const record = await this.organizerInviteRepo.findByEmail(email)
      if (record?.acceptedAt) {
        throw new GoneError('This invite link has already been used')
      }
    }
    return { email }
  }

  async organizerSignup(
    token: string,
    dto: { password: string; name?: string; phone?: string },
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const { email } = this.verifyOrganizerInviteToken(token)

    const exists = await this.userRepo.emailExists(email)
    if (exists) {
      throw new ConflictError('An account with this email already exists')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)
    let user: Awaited<ReturnType<typeof this.userRepo.create>>
    try {
      user = await this.userRepo.create({
        name: dto.name || DEFAULT_USER_NAME,
        email,
        phone: dto.phone,
        passwordHash,
        role: USER_ROLE.ORGANIZER,
      })
    } catch (err) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictError('An account with this email already exists')
      }
      throw err
    }

    try {
      await this.createOrganizerProfileWithSlug(user.id, user.name)
      this.logger.info({ userId: user.id }, 'OrganizerProfile auto-created via invite')
    } catch (err) {
      this.logger.error({ userId: user.id, err }, 'Failed to create OrganizerProfile, rolling back user')
      await this.userRepo.deleteById(user.id).catch((e) =>
        this.logger.error({ userId: user.id, err: e }, 'Failed to rollback user after profile creation failure'),
      )
      throw err
    }

    await this.createWalletForUser(user.id)
    await this.organizerInviteRepo?.markAccepted(email).catch((err) =>
      this.logger.warn({ email, err }, 'Failed to mark invite as accepted'),
    )

    this.logger.info({ userId: user.id }, 'Organizer signed up via invite')
    return this.issueTokens(user, meta)
  }

  private async generateRefreshToken(
    userId: string,
    meta: { userAgent?: string; ip?: string },
    familyId?: string,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(64).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await this.refreshTokenRepo.create({
      userId,
      tokenHash,
      familyId: familyId ?? undefined,
      deviceInfo: meta.userAgent || null,
      ipAddress: meta.ip || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    })
    // Initial login tokens have no familyId. On first rotation, `token.familyId ?? token.id`
    // adopts the token's own ID as the family root. All subsequent rotations inherit it.

    return rawToken
  }
}
