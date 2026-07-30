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
import type { RazorpayXClient } from '../providers/payout/razorpayx.client'
import { PAYOUT_STRATEGY } from '../utils/constants'
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
    /** Dormant until a RazorpayX account exists — see providers/payout/razorpayx.client.ts */
    private razorpayxClient?: RazorpayXClient | null,
  ) {}

  private googleOAuthClient?: import('google-auth-library').OAuth2Client

  async signup(
    dto: SignupDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const timer = startTimer()
    this.logger.info({ role: dto.role }, 'signup: started')
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
      // Server-stamped, never client-supplied — Zod's acceptedTerms literal(true) already
      // rejected the request if this weren't checked.
      tncAcceptedAt: new Date(),
    })

    // Auto-create OrganizerProfile for ORGANIZER signups (same transaction prevents orphans)
    if (user.role === USER_ROLE.ORGANIZER) {
      try {
        // Server-stamped, never client-supplied — Zod's superRefine already rejected
        // the request if acceptedOrganizerAgreement weren't checked for this role.
        await this.createOrganizerProfileWithSlug(user.id, user.name, new Date())
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
    this.logger.info('login: started')

    // Check brute-force lockout before any DB work
    if (this.loginAttemptTracker) {
      const lockoutRemaining = await this.loginAttemptTracker.isLocked(dto.email)
      if (lockoutRemaining > 0) {
        this.logger.warn('login: account locked due to too many attempts')
        throw new AuthError(
          `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(lockoutRemaining / 60)} minutes.`,
        )
      }
    }

    const user = await this.userRepo.findByEmail(dto.email)
    if (!user) {
      // Record failure even for non-existent emails to prevent email enumeration timing attacks
      await this.loginAttemptTracker?.recordFailure(dto.email)
      this.logger.info('login: failed — email not found')
      throw new AuthError('Invalid email or password')
    }
    if (!user.passwordHash) {
      this.logger.info({ userId: user.id, hasGoogleId: !!user.googleId }, 'login: failed — no password hash')
      throw new AuthError(
        user.googleId
          ? 'This account uses Google sign-in. Please use the Google button.'
          : 'Invalid email or password',
      )
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      await this.loginAttemptTracker?.recordFailure(dto.email)
      this.logger.info({ userId: user.id }, 'login: failed — invalid password')
      throw new AuthError('Invalid email or password')
    }

    if (!user.isActive) {
      this.logger.warn({ userId: user.id }, 'login: failed — account deactivated')
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
    user: {
      id: string
      name: string
      email: string | null
      phone: string | null
      phoneVerified: boolean
      role: string
      avatarUrl: string | null
    },
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
          phone: user.phone ?? undefined,
          phoneVerified: user.phoneVerified,
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
      phone: user.phone ?? undefined,
      phoneVerified: user.phoneVerified,
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
    dto: { name?: string; role?: SignupRole; acceptedOrganizerAgreement?: boolean },
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
        // Server-stamped, never client-supplied — Zod's superRefine already rejected
        // the request if acceptedOrganizerAgreement weren't checked for this role.
        await this.createOrganizerProfileWithSlug(userId, dto.name || user.name, new Date())
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
          bankAccountLinked: env.PAYOUT_STRATEGY === PAYOUT_STRATEGY.RAZORPAYX_PAYOUTS
            ? !!user.organizerProfile.razorpayxFundAccountId
            : this.gateway?.provider === PAYMENT_PROVIDER.CASHFREE
              ? !!user.organizerProfile.cashfreeVendorId
              : !!user.organizerProfile.razorpayAccountId,
          commissionRate: Number(user.organizerProfile.commissionRate),
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
      emailVerified: user.emailVerified,
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
   * Links the organizer's bank account.
   *
   * Strategy selection:
   * - PAYOUT_STRATEGY=razorpayx_payouts: Create RazorpayX Contact + Fund Account only (skips Route).
   * - PAYOUT_STRATEGY=route: Call gateway.createPayoutAccount (Route for Razorpay, Cashfree for Cashfree).
   *
   * Re-link guard: blocks only if the current strategy's provider column is already set,
   * so switching strategies allows linking a new payout account without being blocked.
   *
   * @throws {NotFoundError} OrganizerProfile or User not found
   * @throws {ConflictError} Payout account already linked for the active strategy
   * @throws {PaymentError} Gateway API failure (only when using Route strategy)
   */
  async connectBankAccount(
    userId: string,
    dto: ConnectBankAccountDto,
  ): Promise<ConnectBankAccountResponse> {
    this.logger.info({ userId, strategy: env.PAYOUT_STRATEGY }, 'connectBankAccount: started')
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    const user = await this.userRepo.findById(userId)
    if (!user) throw new NotFoundError('User')

    const masked = dto.accountNumber.slice(-4).padStart(dto.accountNumber.length, '*')

    // RazorpayX Payouts strategy: create Contact + Fund Account, skip Route entirely.
    // This is the primary path when PAYOUT_STRATEGY=razorpayx_payouts.
    if (env.PAYOUT_STRATEGY === PAYOUT_STRATEGY.RAZORPAYX_PAYOUTS) {
      if (!this.razorpayxClient) {
        throw new PaymentError('RazorpayX client not configured for razorpayx_payouts strategy')
      }

      // Re-link guard for RazorpayX: check if Fund Account already exists
      if (profile.razorpayxFundAccountId) {
        throw new ConflictError(PAYOUT_ERROR.ALREADY_LINKED)
      }

      // Create Contact + Fund Account (throws on failure)
      await this.linkRazorpayxAccount(userId, profile.id, dto, user.email)

      this.logger.info({ userId, profileId: profile.id, strategy: 'razorpayx_payouts' }, 'Payout account linked via RazorpayX')
      return { bankAccountLinked: true, maskedAccountNumber: masked }
    }

    // Route strategy (default): use the active payment gateway (Razorpay or Cashfree)
    if (!this.gateway) throw new PaymentError(PAYOUT_ERROR.GATEWAY_NOT_CONFIGURED)

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

    let acct: Awaited<ReturnType<IPaymentGateway['createPayoutAccount']>>
    try {
      acct = await this.gateway.createPayoutAccount({
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
    } catch (err) {
      this.logger.error({ err, userId, profileId: profile.id, provider }, 'connectBankAccount: gateway createPayoutAccount failed')
      throw err
    }

    // Atomic CAS — prevents race condition when two requests pass the check above
    const { count } = await this.organizerProfileRepo.linkPayoutAccount(profile.id, acct.provider, acct.accountId)
    if (count === 0) {
      this.logger.warn(
        { userId, profileId: profile.id, orphanedAccountId: acct.accountId, provider: acct.provider },
        'CAS failed after payout account creation — orphaned account',
      )
      throw new ConflictError(PAYOUT_ERROR.ALREADY_LINKED)
    }

    this.logger.info({ userId, profileId: profile.id, provider, strategy: 'route' }, 'Payout account linked via Route')
    return { bankAccountLinked: true, maskedAccountNumber: masked }
  }

  /**
   * Creates RazorpayX Contact + Fund Account for organizer bank linking.
   * Called from connectBankAccount when PAYOUT_STRATEGY=razorpayx_payouts.
   * Throws on failure since this is the primary (and only) path for that strategy.
   * Assumes caller has already verified this.razorpayxClient is configured.
   *
   * @throws {PaymentError} Contact or Fund Account creation failed
   */
  private async linkRazorpayxAccount(
    userId: string,
    profileId: string,
    dto: ConnectBankAccountDto,
    email: string | null,
  ): Promise<void> {
    try {
      const { contactId } = await this.razorpayxClient!.createContact({
        name: dto.accountHolderName,
        email: email ?? undefined,
        referenceId: profileId,
      })
      const { fundAccountId } = await this.razorpayxClient!.createFundAccount({
        contactId,
        accountNumber: dto.accountNumber,
        ifsc: dto.ifscCode,
        beneficiaryName: dto.beneficiaryName,
      })
      await this.organizerProfileRepo.linkRazorpayxAccount(profileId, contactId, fundAccountId)
      this.logger.info({ userId, profileId, contactId, fundAccountId }, 'RazorpayX contact + fund account linked')
    } catch (err) {
      this.logger.error({ userId, profileId, err }, 'RazorpayX contact/fund account linking failed')
      throw new PaymentError(
        `Failed to create RazorpayX payout account: ${err instanceof Error ? err.message : 'Unknown error'}`,
        err,
      )
    }
  }

  /**
   * Authenticates a user via Google OAuth ID token.
   * Flow: verify token → find by googleId → find by email (link) → create new.
   * New users always get role TRAVELER; onboarding handles role selection.
   * Handles P2002 race condition (concurrent signup) by retrying as login.
   * @throws {AuthError} Invalid/unverified Google token, deactivated account, Google not configured
   */
  async googleAuth(
    dto: { idToken: string; acceptedTerms?: boolean },
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string; isNewUser: boolean }> {
    const google = await this.verifyGoogleToken(dto.idToken)
    this.logger.info('googleAuth: started')

    // Case A: existing user by googleId
    let user = await this.userRepo.findByGoogleId(google.sub)
    if (user) {
      if (!user.isActive) throw new AuthError('Account is deactivated')
      // Google's ID token already proves ownership of this email — backfills
      // accounts created before this account was linked, or before this check existed.
      if (!user.emailVerified) user = await this.userRepo.markEmailVerified(user.id)
      this.logger.info({ userId: user.id }, 'Google login (by googleId)')
      return { ...(await this.issueTokens(user, meta)), isNewUser: false }
    }

    // Case B: existing user by email — link googleId + backfill avatar if missing
    user = await this.userRepo.findByEmail(google.email)
    if (user) {
      if (!user.isActive) throw new AuthError('Account is deactivated')
      const avatarToSet = !user.avatarUrl ? google.picture : undefined
      user = await this.userRepo.updateGoogleId(user.id, google.sub, avatarToSet)
      if (!user.emailVerified) user = await this.userRepo.markEmailVerified(user.id)
      this.logger.info({ userId: user.id }, 'Google login (linked googleId)')
      return { ...(await this.issueTokens(user, meta)), isNewUser: false }
    }

    // Case C: new user — always TRAVELER, onboarding handles role.
    // acceptedTerms isn't a Zod literal(true) on googleAuthSchema (the same
    // endpoint also serves existing-user login), so it's enforced here instead —
    // only for the new-user branch.
    if (!dto.acceptedTerms) {
      throw new ValidationError('You must accept the Terms of Service and Privacy Policy')
    }
    try {
      user = await this.userRepo.create({
        name: google.name,
        email: google.email,
        // Google's ID token already proves ownership of this email.
        emailVerified: true,
        googleId: google.sub,
        role: USER_ROLE.TRAVELER,
        avatarUrl: google.picture,
        // Server-stamped, never client-supplied — gated on the acceptedTerms check above.
        tncAcceptedAt: new Date(),
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
  private async createOrganizerProfileWithSlug(
    userId: string,
    businessName: string,
    organizerTncAcceptedAt?: Date,
  ): Promise<void> {
    const slug = await uniqueSlug(businessName, (s) => this.organizerProfileRepo.slugExists(s))
    try {
      await this.organizerProfileRepo.create({
        user: { connect: { id: userId } },
        businessName,
        slug,
        organizerTncAcceptedAt,
      })
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        const fallbackSlug = `${slugify(businessName)}-${Date.now() % 10000}`
        await this.organizerProfileRepo.create({
          user: { connect: { id: userId } },
          businessName,
          slug: fallbackSlug,
          organizerTncAcceptedAt,
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
    dto: { password: string; name?: string; phone?: string; acceptedOrganizerAgreement: true },
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const { email } = this.verifyOrganizerInviteToken(token)
    this.logger.info('organizerSignup: started')

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
      // Server-stamped, never client-supplied — Zod's acceptedOrganizerAgreement
      // literal(true) already rejected the request if this weren't checked.
      await this.createOrganizerProfileWithSlug(user.id, user.name, new Date())
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
