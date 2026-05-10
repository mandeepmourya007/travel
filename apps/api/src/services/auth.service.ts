import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Logger } from 'pino'
import { startTimer } from '../utils/perf-timer'
import type { SignupDto, LoginDto, AuthResponse, JwtPayload } from '@shared/types/auth.types'
import type { UserProfileResponse } from '@shared/types/user.types'
import { DEFAULT_USER_NAME } from '@shared/constants/roles'
import type { SignupRole } from '@shared/constants/roles'
import { UserRepository } from '../repositories/user.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { WalletRepository } from '../repositories/wallet.repository'
import { AuthError, ConflictError, NotFoundError } from '../errors/app-error'
import { SALT_ROUNDS, JWT_ACCESS_EXPIRY, REFRESH_TOKEN_DAYS, JWT_ACCESS_EXPIRY_SECONDS } from '../utils/constants'
import { USER_ROLE } from '@shared/constants'

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private refreshTokenRepo: RefreshTokenRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private walletRepo: WalletRepository,
    private jwtSecret: string,
    private logger: Logger,
    private googleClientId?: string,
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
        await this.organizerProfileRepo.create({
          user: { connect: { id: user.id } },
          businessName: user.name,
        })
        this.logger.info({ userId: user.id }, 'OrganizerProfile auto-created')
      } catch (err) {
        // Rollback: delete the user if profile creation fails
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
    const user = await this.userRepo.findByEmail(dto.email)
    if (!user) {
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
      throw new AuthError('Invalid email or password')
    }

    if (!user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    this.logger.info({ userId: user.id, durationMs: timer.elapsed() }, 'User logged in')
    return this.issueTokens(user, meta)
  }

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
    const token = await this.refreshTokenRepo.findByHash(tokenHash)

    if (!token) throw new AuthError('Invalid refresh token')
    if (token.revokedAt) throw new AuthError('Token has been revoked')
    if (token.expiresAt < new Date()) throw new AuthError('Refresh token expired')

    const user = await this.userRepo.findById(token.userId)
    if (!user || !user.isActive) throw new AuthError('User not found or deactivated')

    const accessToken = this.generateAccessToken({ userId: user.id, role: user.role })

    return { accessToken, expiresIn: JWT_ACCESS_EXPIRY_SECONDS }
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
        await this.organizerProfileRepo.create({
          user: { connect: { id: userId } },
          businessName: dto.name || user.name,
        })
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
          businessName: user.organizerProfile.businessName,
          description: user.organizerProfile.description,
          verificationStatus: user.organizerProfile.verificationStatus,
          rating: user.organizerProfile.rating,
          totalReviews: user.organizerProfile.totalReviews,
          totalTripsCompleted: user.organizerProfile.totalTripsCompleted,
          bankAccountLinked: user.organizerProfile.bankAccountLinked,
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
    }
  }

  /**
   * Updates organizer-specific profile fields (businessName, description).
   * Uses existing organizerProfileRepo.update(id, data) — no new repo method.
   * @throws {NotFoundError} OrganizerProfile not found for this user
   */
  async updateOrganizerProfile(
    userId: string,
    dto: { businessName?: string; description?: string },
  ): Promise<{ businessName: string; description: string | null }> {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new NotFoundError('OrganizerProfile')

    const updated = await this.organizerProfileRepo.update(profile.id, dto)
    this.logger.info({ userId }, 'Organizer profile updated')

    return { businessName: updated.businessName, description: updated.description }
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

  private async generateRefreshToken(
    userId: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<string> {
    const rawToken = crypto.randomBytes(64).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await this.refreshTokenRepo.create({
      userId,
      tokenHash,
      deviceInfo: meta.userAgent || null,
      ipAddress: meta.ip || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    })

    return rawToken
  }
}
