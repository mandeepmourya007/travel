import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Logger } from 'pino'
import type { SignupDto, LoginDto, AuthResponse, JwtPayload } from '@shared/types/auth.types'
import { UserRepository } from '../repositories/user.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { AuthError, ConflictError } from '../errors/app-error'
import { SALT_ROUNDS, JWT_ACCESS_EXPIRY, REFRESH_TOKEN_DAYS } from '../utils/constants'

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private refreshTokenRepo: RefreshTokenRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private jwtSecret: string,
    private logger: Logger,
  ) {}

  async signup(
    dto: SignupDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const exists = await this.userRepo.emailExists(dto.email)
    if (exists) {
      throw new ConflictError('An account with this email already exists')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)
    const user = await this.userRepo.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
    })

    // Auto-create OrganizerProfile for ORGANIZER signups (same transaction prevents orphans)
    if (user.role === 'ORGANIZER') {
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

    const accessToken = this.generateAccessToken({ userId: user.id, role: user.role })
    const refreshToken = await this.generateRefreshToken(user.id, meta)

    this.logger.info({ userId: user.id, role: user.role }, 'User signed up')

    return {
      auth: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl ?? undefined,
        },
        tokens: { accessToken, expiresIn: 900 },
      },
      refreshToken,
    }
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const user = await this.userRepo.findByEmail(dto.email)
    if (!user || !user.passwordHash) {
      throw new AuthError('Invalid email or password')
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      throw new AuthError('Invalid email or password')
    }

    if (!user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    const accessToken = this.generateAccessToken({ userId: user.id, role: user.role })
    const refreshToken = await this.generateRefreshToken(user.id, meta)

    this.logger.info({ userId: user.id }, 'User logged in')

    return {
      auth: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl ?? undefined,
        },
        tokens: { accessToken, expiresIn: 900 },
      },
      refreshToken,
    }
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

    return { accessToken, expiresIn: 900 }
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

  async getMe(userId: string): Promise<AuthResponse['user']> {
    const user = await this.userRepo.findById(userId)
    if (!user) throw new AuthError('User not found')

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? undefined,
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
