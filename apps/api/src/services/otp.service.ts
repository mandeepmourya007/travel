import crypto from 'crypto'
import type { Logger } from 'pino'
import type { AuthResponse } from '@shared/types/auth.types'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { UserRepository } from '../repositories/user.repository'
import { AuthService } from './auth.service'
import type { IOtpProvider } from '../providers/otp-provider.interface'
import type { IEmailProvider } from '../providers/email-provider.interface'
import { ValidationError, AuthError, TooManyRequestsError, AppError } from '../errors/app-error'
import { normalizePhone } from '../utils/phone'
import { normalizeEmail } from '../utils/email'
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_RATE_LIMIT_WINDOW_MINUTES,
  OTP_RATE_LIMIT_MAX_SENDS,
  DEV_OTP,
} from '../utils/constants'

type OtpType = 'PHONE_OTP' | 'EMAIL_OTP'

export class OtpService {
  constructor(
    private verifCodeRepo: VerificationCodeRepository,
    private userRepo: UserRepository,
    private authService: AuthService,
    private otpProvider: IOtpProvider,
    private emailProvider: IEmailProvider,
    private logger: Logger,
  ) {}

  // ── Private helpers ────────────────────────────────

  private generateOtp(): string {
    return process.env.NODE_ENV === 'production'
      ? crypto.randomInt(1000, 10000).toString()
      : DEV_OTP
  }

  private hashOtp(otp: string): string {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.createHash('sha256').update(salt + otp).digest('hex')
    return `${salt}:${hash}`
  }

  private async checkCooldown(identifier: string, type: OtpType): Promise<void> {
    const latest = await this.verifCodeRepo.findLatestByIdentifier(identifier, type)
    if (latest) {
      const secondsSinceLast = (Date.now() - latest.createdAt.getTime()) / 1000
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        throw new TooManyRequestsError(
          `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before resending`,
        )
      }
    }
  }

  private async checkRateLimit(identifier: string, type: OtpType): Promise<void> {
    const recentCount = await this.verifCodeRepo.countRecentByIdentifier(
      identifier, type, OTP_RATE_LIMIT_WINDOW_MINUTES,
    )
    if (recentCount >= OTP_RATE_LIMIT_MAX_SENDS) {
      throw new TooManyRequestsError('Too many OTP requests. Try again later.')
    }
  }

  private async verifyCode(identifier: string, type: OtpType, otp: string) {
    const code = await this.verifCodeRepo.findLatestByIdentifier(identifier, type)
    if (!code) throw new AuthError('No OTP found. Please request a new one.')

    if (code.attempts >= OTP_MAX_ATTEMPTS) {
      throw new AuthError('Too many failed attempts. Please request a new OTP.')
    }

    if (code.expiresAt < new Date()) {
      throw new AuthError('OTP has expired. Please request a new one.')
    }

    const [storedSalt, storedHash] = code.codeHash.split(':')
    const candidateHash = crypto.createHash('sha256').update(storedSalt + otp).digest('hex')
    if (candidateHash !== storedHash) {
      await this.verifCodeRepo.incrementAttempts(code.id)
      throw new AuthError('Invalid OTP')
    }

    await this.verifCodeRepo.markUsed(code.id)
    return code
  }

  // ── Phone OTP (existing) ──────────────────────────

  /**
   * Sends a 4-digit OTP to the given Indian phone number.
   * Enforces 30s resend cooldown and max 3 sends per 10 minutes.
   * In non-production environments, always uses DEV_OTP ('0000').
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {TooManyRequestsError} Resend cooldown or rate limit exceeded
   */
  async sendOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    await this.checkCooldown(phone, 'PHONE_OTP')
    await this.checkRateLimit(phone, 'PHONE_OTP')
    await this.verifCodeRepo.invalidateExisting(phone, 'PHONE_OTP')

    const otp = this.generateOtp()
    const codeHash = this.hashOtp(otp)

    await this.verifCodeRepo.create({
      type: 'PHONE_OTP',
      identifier: phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    })

    const sendResult = await this.otpProvider.sendOtp(phone, otp)
    if (!sendResult.success) {
      throw new AppError('Failed to send OTP. Please try again.', 502, 'OTP_SEND_FAILED')
    }

    this.logger.info({ phone: `****${phone.slice(-4)}`, channel: sendResult.channel }, 'OTP sent')

    return { message: 'OTP sent', retryAfter: OTP_RESEND_COOLDOWN_SECONDS }
  }

  /**
   * Verifies a 4-digit OTP for the given phone number.
   * Auto-creates a TRAVELER user if the phone is new.
   * Returns auth tokens and isNewUser flag for routing.
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {AuthError} No OTP found, expired, max attempts exceeded, or wrong OTP
   * @throws {AuthError} Account is deactivated
   */
  async verifyOtp(
    rawPhone: string,
    otp: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string; isNewUser: boolean }> {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    await this.verifyCode(phone, 'PHONE_OTP', otp)

    let user = await this.userRepo.findByPhone(phone)
    let isNewUser = false

    if (user && !user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    if (!user) {
      user = await this.userRepo.create({
        name: 'User',
        phone,
        role: 'TRAVELER',
        phoneVerified: true,
      })
      isNewUser = true
      this.logger.info({ userId: user.id }, 'Auto-created user via OTP')
    }

    const { auth, refreshToken } = await this.authService.issueTokens(user, meta)

    this.logger.info({ userId: user.id, isNewUser }, 'OTP verified')

    return { auth, refreshToken, isNewUser }
  }

  // ── Email OTP (new) ───────────────────────────────

  /**
   * Sends a 4-digit OTP to the given email address.
   * Same rate-limiting and cooldown rules as phone OTP.
   * @throws {ValidationError} Invalid email format
   * @throws {TooManyRequestsError} Resend cooldown or rate limit exceeded
   */
  async sendEmailOtp(rawEmail: string) {
    const email = normalizeEmail(rawEmail)
    if (!email) throw new ValidationError('Invalid email address')

    await this.checkCooldown(email, 'EMAIL_OTP')
    await this.checkRateLimit(email, 'EMAIL_OTP')
    await this.verifCodeRepo.invalidateExisting(email, 'EMAIL_OTP')

    const otp = this.generateOtp()
    const codeHash = this.hashOtp(otp)

    await this.verifCodeRepo.create({
      type: 'EMAIL_OTP',
      identifier: email,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    })

    const sendResult = await this.emailProvider.sendOtp(email, otp)
    if (!sendResult.success) {
      throw new AppError('Failed to send OTP. Please try again.', 502, 'OTP_SEND_FAILED')
    }

    this.logger.info({ email: `${email.slice(0, 3)}***` }, 'Email OTP sent')

    return { message: 'OTP sent', retryAfter: OTP_RESEND_COOLDOWN_SECONDS }
  }

  /**
   * Verifies a 4-digit email OTP.
   * Auto-creates a TRAVELER user if email is new (passwordless signup).
   * Existing email+password users can login via OTP (passwordless fallback).
   * @throws {ValidationError} Invalid email format
   * @throws {AuthError} No OTP found, expired, max attempts exceeded, or wrong OTP
   * @throws {AuthError} Account is deactivated
   */
  async verifyEmailOtp(
    rawEmail: string,
    otp: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string; isNewUser: boolean }> {
    const email = normalizeEmail(rawEmail)
    if (!email) throw new ValidationError('Invalid email address')

    await this.verifyCode(email, 'EMAIL_OTP', otp)

    let user = await this.userRepo.findByEmail(email)
    let isNewUser = false

    if (user && !user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    if (!user) {
      user = await this.userRepo.create({
        name: 'User',
        email,
        role: 'TRAVELER',
        emailVerified: true,
      })
      isNewUser = true
      this.logger.info({ userId: user.id }, 'Auto-created user via email OTP')
    } else {
      this.logger.info({ userId: user.id }, 'Passwordless email login')
    }

    const { auth, refreshToken } = await this.authService.issueTokens(user, meta)

    this.logger.info({ userId: user.id, isNewUser }, 'Email OTP verified')

    return { auth, refreshToken, isNewUser }
  }
}
