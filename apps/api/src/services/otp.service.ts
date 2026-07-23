import crypto from 'crypto'
import type { Logger } from 'pino'
import type { AuthResponse, AttachPhoneResponse, AttachEmailResponse } from '@shared/types/auth.types'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { UserRepository } from '../repositories/user.repository'
import { AuthService } from './auth.service'
import type { IOtpProvider } from '../providers/otp-provider.interface'
import type { IEmailProvider } from '../providers/email-provider.interface'
import { ValidationError, AuthError, TooManyRequestsError, AppError, ConflictError } from '../errors/app-error'
import { normalizePhone } from '../utils/phone'
import { normalizeEmail } from '../utils/email'
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_RATE_LIMIT_WINDOW_MINUTES,
  OTP_RATE_LIMIT_MAX_SENDS,
  // DEV_OTP, // unused while the fixed dev-OTP shortcut in generateOtp() is disabled
  OTP_TYPE,
} from '../utils/constants'
import { USER_ROLE, DEFAULT_USER_NAME, AUTH_ERROR_CODE } from '@shared/constants'

type OtpType = typeof OTP_TYPE[keyof typeof OTP_TYPE]

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
    // Fixed dev OTP disabled — always generate a real random OTP so it matches
    // what's actually delivered via WhatsApp/SMS. Uncomment to restore the
    // fixed '0000' OTP shortcut for non-production environments.
    // return process.env.NODE_ENV === 'production'
    //   ? crypto.randomInt(1000, 10000).toString()
    //   : DEV_OTP
    return crypto.randomInt(1000, 10000).toString()
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
   * The fixed DEV_OTP ('0000') shortcut for non-production is currently disabled
   * (see generateOtp()) — a real random OTP is generated in every environment.
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {TooManyRequestsError} Resend cooldown or rate limit exceeded
   */
  async sendOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    return this.sendPhoneOtpMechanics(phone)
  }

  /**
   * The actual send mechanics for a phone-identifier OTP: cooldown/rate-limit checks,
   * code generation + storage, delivery via the OTP provider. Assumes `phone` is
   * already normalized. Shared by the public `sendOtp`, the authenticated
   * `sendPhoneOtpForAttach`, and `sendBookingContactOtp` — no user-lookup/auto-signup
   * logic lives here. `type` defaults to PHONE_OTP so existing callers are unaffected;
   * pass a distinct type (e.g. BOOKING_CONTACT_OTP) to keep that flow's in-flight code
   * from clobbering (or being clobbered by) another flow's code for the same phone number.
   */
  private async sendPhoneOtpMechanics(phone: string, type: OtpType = OTP_TYPE.PHONE_OTP) {
    await this.checkCooldown(phone, type)
    await this.checkRateLimit(phone, type)
    await this.verifCodeRepo.invalidateExisting(phone, type)

    const otp = this.generateOtp()
    const codeHash = this.hashOtp(otp)

    await this.verifCodeRepo.create({
      type,
      identifier: phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    })

    const sendResult = await this.otpProvider.sendOtp(phone, otp)
    if (!sendResult.success) {
      throw new AppError('Failed to send OTP. Please try again.', 502, 'OTP_SEND_FAILED')
    }

    this.logger.info({ phone: `****${phone.slice(-4)}`, channel: sendResult.channel }, 'OTP sent')

    return { message: 'OTP sent', retryAfter: OTP_RESEND_COOLDOWN_SECONDS, channel: sendResult.channel }
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

    await this.verifyCode(phone, OTP_TYPE.PHONE_OTP, otp)

    let user = await this.userRepo.findByPhone(phone)
    let isNewUser = false

    if (user && !user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    if (!user) {
      user = await this.userRepo.create({
        name: DEFAULT_USER_NAME,
        phone,
        role: USER_ROLE.TRAVELER,
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

    await this.checkCooldown(email, OTP_TYPE.EMAIL_OTP)
    await this.checkRateLimit(email, OTP_TYPE.EMAIL_OTP)
    await this.verifCodeRepo.invalidateExisting(email, OTP_TYPE.EMAIL_OTP)

    const otp = this.generateOtp()
    const codeHash = this.hashOtp(otp)

    await this.verifCodeRepo.create({
      type: OTP_TYPE.EMAIL_OTP,
      identifier: email,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    })

    const smtpStart = Date.now()
    const sendResult = await this.emailProvider.sendOtp(email, otp)
    const smtpDurationMs = Date.now() - smtpStart
    this.logger.info({ email: `${email.slice(0, 3)}***`, smtpDurationMs }, 'Email OTP sendOtp completed')
    if (!sendResult.success) {
      // Pass the provider's underlying error as `cause` — without it the real reason
      // (bad sender domain, SMTP auth failure, rate limit, etc.) is silently dropped
      // and every occurrence of this error is undiagnosable in Sentry.
      throw new AppError('Failed to send OTP. Please try again.', 502, 'OTP_SEND_FAILED', true, sendResult.error)
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

    await this.verifyCode(email, OTP_TYPE.EMAIL_OTP, otp)

    let user = await this.userRepo.findByEmail(email)
    let isNewUser = false

    if (user && !user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    if (!user) {
      user = await this.userRepo.create({
        name: DEFAULT_USER_NAME,
        email,
        role: USER_ROLE.TRAVELER,
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

  // ── Attach phone (authenticated) ──────────────────
  // Lets an already-logged-in user (any auth method — email, Google, organizer
  // invite) attach + verify a phone WITHOUT replacing their session. Distinct
  // from the public sendOtp/verifyOtp, which auto-signup/login by phone.

  /**
   * Sends an ATTACH_PHONE_OTP to attach to the authenticated user's account.
   * Distinct type from the public PHONE_OTP flow — see `OTP_TYPE.ATTACH_PHONE_OTP`.
   * Rejects up-front if the phone already belongs to a different account.
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {ConflictError} Phone already linked to another account
   * @throws {TooManyRequestsError} Resend cooldown or rate limit exceeded
   */
  async sendPhoneOtpForAttach(userId: string, rawPhone: string) {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    const owner = await this.userRepo.findByPhone(phone)
    if (owner && owner.id !== userId) {
      throw new ConflictError('This phone number is already linked to another account', AUTH_ERROR_CODE.PHONE_TAKEN)
    }

    return this.sendPhoneOtpMechanics(phone, OTP_TYPE.ATTACH_PHONE_OTP)
  }

  /**
   * Verifies an ATTACH_PHONE_OTP and attaches the phone to the authenticated user.
   * Session-preserving — never issues tokens, never touches the refresh cookie.
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {AuthError} No OTP found, expired, max attempts exceeded, or wrong OTP
   * @throws {ConflictError} Phone already linked to another account (race-safe)
   */
  async verifyPhoneOtpForAttach(userId: string, rawPhone: string, otp: string): Promise<AttachPhoneResponse> {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    await this.verifyCode(phone, OTP_TYPE.ATTACH_PHONE_OTP, otp)

    // Race-safety second check — another user may have claimed this phone
    // between the send-side pre-check and this verify call.
    const owner = await this.userRepo.findByPhone(phone)
    if (owner && owner.id !== userId) {
      throw new ConflictError('This phone number is already linked to another account', AUTH_ERROR_CODE.PHONE_TAKEN)
    }

    let updated
    try {
      updated = await this.userRepo.setPhone(userId, phone)
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictError('This phone number is already linked to another account', AUTH_ERROR_CODE.PHONE_TAKEN)
      }
      throw err
    }

    this.logger.info({ userId }, 'Phone attached and verified')

    return { phone: updated.phone!, phoneVerified: updated.phoneVerified }
  }

  // ── Attach email (authenticated) ──────────────────
  // Mirrors sendPhoneOtpForAttach/verifyPhoneOtpForAttach exactly, for email instead
  // of phone. Lets an already-logged-in user (any auth method) attach + verify an
  // email WITHOUT replacing their session.

  /**
   * Sends an ATTACH_EMAIL_OTP to attach to the authenticated user's account.
   * Distinct type from the public EMAIL_OTP flow — see `OTP_TYPE.ATTACH_EMAIL_OTP`.
   * Rejects up-front if the email already belongs to a different account.
   * @throws {ValidationError} Invalid email format
   * @throws {ConflictError} Email already linked to another account
   * @throws {TooManyRequestsError} Resend cooldown or rate limit exceeded
   */
  async sendEmailOtpForAttach(userId: string, rawEmail: string) {
    const email = normalizeEmail(rawEmail)
    if (!email) throw new ValidationError('Invalid email address')

    const owner = await this.userRepo.findByEmail(email)
    if (owner && owner.id !== userId) {
      throw new ConflictError('This email is already linked to another account', AUTH_ERROR_CODE.EMAIL_TAKEN)
    }

    await this.checkCooldown(email, OTP_TYPE.ATTACH_EMAIL_OTP)
    await this.checkRateLimit(email, OTP_TYPE.ATTACH_EMAIL_OTP)
    await this.verifCodeRepo.invalidateExisting(email, OTP_TYPE.ATTACH_EMAIL_OTP)

    const otp = this.generateOtp()
    const codeHash = this.hashOtp(otp)

    await this.verifCodeRepo.create({
      type: OTP_TYPE.ATTACH_EMAIL_OTP,
      identifier: email,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    })

    const sendResult = await this.emailProvider.sendOtp(email, otp)
    if (!sendResult.success) {
      throw new AppError('Failed to send OTP. Please try again.', 502, 'OTP_SEND_FAILED', true, sendResult.error)
    }

    this.logger.info({ email: `${email.slice(0, 3)}***` }, 'Attach email OTP sent')

    return { message: 'OTP sent', retryAfter: OTP_RESEND_COOLDOWN_SECONDS }
  }

  /**
   * Verifies an ATTACH_EMAIL_OTP and attaches the email to the authenticated user.
   * Session-preserving — never issues tokens, never touches the refresh cookie.
   * @throws {ValidationError} Invalid email format
   * @throws {AuthError} No OTP found, expired, max attempts exceeded, or wrong OTP
   * @throws {ConflictError} Email already linked to another account (race-safe)
   */
  async verifyEmailOtpForAttach(userId: string, rawEmail: string, otp: string): Promise<AttachEmailResponse> {
    const email = normalizeEmail(rawEmail)
    if (!email) throw new ValidationError('Invalid email address')

    await this.verifyCode(email, OTP_TYPE.ATTACH_EMAIL_OTP, otp)

    // Race-safety second check — another user may have claimed this email
    // between the send-side pre-check and this verify call.
    const owner = await this.userRepo.findByEmail(email)
    if (owner && owner.id !== userId) {
      throw new ConflictError('This email is already linked to another account', AUTH_ERROR_CODE.EMAIL_TAKEN)
    }

    let updated
    try {
      updated = await this.userRepo.setEmail(userId, email)
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictError('This email is already linked to another account', AUTH_ERROR_CODE.EMAIL_TAKEN)
      }
      throw err
    }

    this.logger.info({ userId }, 'Email attached and verified')

    return { email: updated.email!, emailVerified: updated.emailVerified }
  }

  // ── Booking contact OTP (post-payment, per-booking) ────
  // Verifies a contact number FOR A SPECIFIC BOOKING — which may not belong to the
  // account owner (e.g. booking on behalf of a friend). Deliberately has NO User-table
  // access at all: it must never read or write `User.phone`/`User.phoneVerified`. The
  // caller (BookingService) is responsible for persisting the verified contact onto the
  // booking's TravelerDetail record. Do not reuse sendPhoneOtpForAttach/
  // verifyPhoneOtpForAttach here — those unconditionally write to User.

  /**
   * Sends a BOOKING_CONTACT_OTP to the given phone number. No user lookup.
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {TooManyRequestsError} Resend cooldown or rate limit exceeded
   */
  async sendBookingContactOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    return this.sendPhoneOtpMechanics(phone, OTP_TYPE.BOOKING_CONTACT_OTP)
  }

  /**
   * Verifies a BOOKING_CONTACT_OTP for the given phone number. No user lookup or write.
   * @throws {ValidationError} Invalid phone format after normalization
   * @throws {AuthError} No OTP found, expired, max attempts exceeded, or wrong OTP
   */
  async verifyBookingContactOtp(rawPhone: string, otp: string): Promise<{ phone: string }> {
    const phone = normalizePhone(rawPhone)
    if (!phone) throw new ValidationError('Invalid phone number')

    await this.verifyCode(phone, OTP_TYPE.BOOKING_CONTACT_OTP, otp)

    return { phone }
  }
}
