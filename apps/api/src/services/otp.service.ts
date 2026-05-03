import crypto from 'crypto'
import type { Logger } from 'pino'
import type { AuthResponse } from '@shared/types/auth.types'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { UserRepository } from '../repositories/user.repository'
import { AuthService } from './auth.service'
import type { IOtpProvider } from '../providers/otp-provider.interface'
import { ValidationError, AuthError, TooManyRequestsError, AppError } from '../errors/app-error'
import { normalizePhone } from '../utils/phone'
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_RATE_LIMIT_WINDOW_MINUTES,
  OTP_RATE_LIMIT_MAX_SENDS,
  DEV_OTP,
} from '../utils/constants'

export class OtpService {
  constructor(
    private verifCodeRepo: VerificationCodeRepository,
    private userRepo: UserRepository,
    private authService: AuthService,
    private otpProvider: IOtpProvider,
    private logger: Logger,
  ) {}

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

    const latest = await this.verifCodeRepo.findLatestByIdentifier(phone, 'PHONE_OTP')
    if (latest) {
      const secondsSinceLast = (Date.now() - latest.createdAt.getTime()) / 1000
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        throw new TooManyRequestsError(
          `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before resending`,
        )
      }
    }

    const recentCount = await this.verifCodeRepo.countRecentByIdentifier(
      phone, 'PHONE_OTP', OTP_RATE_LIMIT_WINDOW_MINUTES,
    )
    if (recentCount >= OTP_RATE_LIMIT_MAX_SENDS) {
      throw new TooManyRequestsError('Too many OTP requests. Try again later.')
    }

    await this.verifCodeRepo.invalidateExisting(phone, 'PHONE_OTP')

    const otp = process.env.NODE_ENV === 'production'
      ? crypto.randomInt(1000, 10000).toString()
      : DEV_OTP

    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.createHash('sha256').update(salt + otp).digest('hex')
    const codeHash = `${salt}:${hash}`

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

    const code = await this.verifCodeRepo.findLatestByIdentifier(phone, 'PHONE_OTP')
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
}
