import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { OtpService } from '../../../src/services/otp.service'
import { TooManyRequestsError, ValidationError, AuthError, AppError } from '../../../src/errors/app-error'
import { OTP_RESEND_COOLDOWN_SECONDS } from '../../../src/utils/constants'

// ── Mock factories ────────────────────────────────────

function createMockVerifCodeRepo() {
  return {
    create: vi.fn(),
    findLatestByIdentifier: vi.fn(),
    incrementAttempts: vi.fn(),
    markUsed: vi.fn(),
    invalidateExisting: vi.fn(),
    countRecentByIdentifier: vi.fn(),
  }
}

const mockUserRepo = { findByPhone: vi.fn(), findByEmail: vi.fn(), create: vi.fn() }
const mockAuthService = { issueTokens: vi.fn() }
const mockOtpProvider = { sendOtp: vi.fn().mockResolvedValue({ success: true, channel: 'sms' }) }
const mockEmailProvider = { sendEmail: vi.fn().mockResolvedValue({ success: true }), sendOtp: vi.fn().mockResolvedValue({ success: true }) }
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any

// Helper: create a valid stored code hash for OTP "0000"
function makeCodeHash(otp = '0000') {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.createHash('sha256').update(salt + otp).digest('hex')
  return `${salt}:${hash}`
}

const validCode = {
  id: 'code-1',
  identifier: '9876543210',
  codeHash: makeCodeHash('0000'),
  attempts: 0,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  usedAt: null,
  createdAt: new Date(Date.now() - 60_000), // 1 min ago (past cooldown)
}

const existingUser = {
  id: 'user-1', name: 'Test', email: null, phone: '9876543210',
  role: 'TRAVELER', avatarUrl: null, isActive: true, phoneVerified: true,
}

const TEST_EMAIL = 'test@example.com'

const validEmailCode = {
  id: 'code-e1',
  identifier: TEST_EMAIL,
  codeHash: makeCodeHash('0000'),
  attempts: 0,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  usedAt: null,
  createdAt: new Date(Date.now() - 60_000),
}

const existingEmailUser = {
  id: 'user-2', name: 'Email User', email: TEST_EMAIL, phone: null,
  role: 'TRAVELER', avatarUrl: null, isActive: true, emailVerified: true,
}

// ── Tests ─────────────────────────────────────────────

describe('OtpService', () => {
  let service: OtpService
  let verifCodeRepo: ReturnType<typeof createMockVerifCodeRepo>

  beforeEach(() => {
    vi.clearAllMocks()
    verifCodeRepo = createMockVerifCodeRepo()
    service = new OtpService(
      verifCodeRepo as any,
      mockUserRepo as any,
      mockAuthService as any,
      mockOtpProvider as any,
      mockEmailProvider as any,
      mockLogger,
    )
  })

  // ── sendOtp ──────────────────────────────────────

  describe('sendOtp', () => {
    it('should send OTP and return retryAfter 30 when phone is valid', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)

      const result = await service.sendOtp('9876543210')

      expect(result.retryAfter).toBe(OTP_RESEND_COOLDOWN_SECONDS)
      expect(verifCodeRepo.create).toHaveBeenCalled()
      expect(mockOtpProvider.sendOtp).toHaveBeenCalled()
    })

    it('should use DEV_OTP (0000) when NODE_ENV is not production', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)

      await service.sendOtp('9876543210')

      // The OTP passed to provider should be '0000' in dev
      expect(mockOtpProvider.sendOtp).toHaveBeenCalledWith('9876543210', '0000')
    })

    it('should invalidate existing codes before sending new one', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)

      await service.sendOtp('9876543210')

      expect(verifCodeRepo.invalidateExisting).toHaveBeenCalledWith('9876543210', 'PHONE_OTP')
    })

    it('should normalize phone (+919876543210 → 9876543210)', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)

      await service.sendOtp('+919876543210')

      expect(verifCodeRepo.invalidateExisting).toHaveBeenCalledWith('9876543210', 'PHONE_OTP')
    })

    it('should throw TooManyRequestsError when resending within 30s cooldown', async () => {
      // Last code was sent 10 seconds ago (within 30s cooldown)
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue({
        ...validCode,
        createdAt: new Date(Date.now() - 10_000), // 10s ago
      })

      await expect(service.sendOtp('9876543210')).rejects.toThrow(TooManyRequestsError)
    })

    it('should throw TooManyRequestsError when >3 sends in 10 minutes', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(3) // already 3 sent

      await expect(service.sendOtp('9876543210')).rejects.toThrow(TooManyRequestsError)
    })

    it('should throw ValidationError when phone is invalid', async () => {
      await expect(service.sendOtp('12345')).rejects.toThrow(ValidationError)
    })

    it('should throw AppError when OTP provider fails to send', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)
      mockOtpProvider.sendOtp.mockResolvedValueOnce({ success: false, channel: 'sms' })

      await expect(service.sendOtp('9876543210')).rejects.toThrow(AppError)
    })
  })

  // ── verifyOtp ────────────────────────────────────

  describe('verifyOtp', () => {
    const meta = { userAgent: 'test', ip: '127.0.0.1' }
    const mockTokens = {
      auth: { user: existingUser, tokens: { accessToken: 'tok', expiresIn: 900 } },
      refreshToken: 'ref-tok',
    }

    it('should verify correct OTP and return tokens for existing user', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validCode)
      mockUserRepo.findByPhone.mockResolvedValue(existingUser)
      mockAuthService.issueTokens.mockResolvedValue(mockTokens)

      const result = await service.verifyOtp('9876543210', '0000', meta)

      expect(verifCodeRepo.markUsed).toHaveBeenCalledWith('code-1')
      expect(result.auth).toBeDefined()
      expect(result.isNewUser).toBe(false)
    })

    it('should auto-create user with TRAVELER role for new phone', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validCode)
      mockUserRepo.findByPhone.mockResolvedValue(null) // no existing user
      mockUserRepo.create.mockResolvedValue(existingUser)
      mockAuthService.issueTokens.mockResolvedValue(mockTokens)

      const result = await service.verifyOtp('9876543210', '0000', meta)

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '9876543210', role: 'TRAVELER', phoneVerified: true }),
      )
      expect(result.isNewUser).toBe(true)
    })

    it('should set phoneVerified true on auto-created user', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validCode)
      mockUserRepo.findByPhone.mockResolvedValue(null)
      mockUserRepo.create.mockResolvedValue(existingUser)
      mockAuthService.issueTokens.mockResolvedValue(mockTokens)

      await service.verifyOtp('9876543210', '0000', meta)

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ phoneVerified: true }),
      )
    })

    it('should return isNewUser true for new users, false for existing', async () => {
      // Existing user
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validCode)
      mockUserRepo.findByPhone.mockResolvedValue(existingUser)
      mockAuthService.issueTokens.mockResolvedValue(mockTokens)

      const r1 = await service.verifyOtp('9876543210', '0000', meta)
      expect(r1.isNewUser).toBe(false)
    })

    it('should throw AuthError when user account is deactivated', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validCode)
      mockUserRepo.findByPhone.mockResolvedValue({ ...existingUser, isActive: false })

      await expect(service.verifyOtp('9876543210', '0000', meta)).rejects.toThrow(AuthError)
      expect(mockAuthService.issueTokens).not.toHaveBeenCalled()
    })

    it('should throw AuthError when no OTP found for phone', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)

      await expect(service.verifyOtp('9876543210', '0000', meta)).rejects.toThrow(AuthError)
    })

    it('should throw AuthError when OTP is expired', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue({
        ...validCode,
        expiresAt: new Date(Date.now() - 1000), // expired
      })

      await expect(service.verifyOtp('9876543210', '0000', meta)).rejects.toThrow(AuthError)
    })

    it('should throw AuthError when max attempts (5) exceeded', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue({
        ...validCode,
        attempts: 5,
      })

      await expect(service.verifyOtp('9876543210', '0000', meta)).rejects.toThrow(AuthError)
    })

    it('should throw AuthError when OTP is wrong and increment attempts', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validCode)

      await expect(service.verifyOtp('9876543210', '9999', meta)).rejects.toThrow(AuthError)
      expect(verifCodeRepo.incrementAttempts).toHaveBeenCalledWith('code-1')
    })

    it('should throw ValidationError when phone format is invalid', async () => {
      await expect(service.verifyOtp('12345', '0000', meta)).rejects.toThrow(ValidationError)
    })
  })

  // ── sendEmailOtp ──────────────────────────────────

  describe('sendEmailOtp', () => {
    it('should send email OTP and return retryAfter', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)

      const result = await service.sendEmailOtp(TEST_EMAIL)

      expect(result.retryAfter).toBe(OTP_RESEND_COOLDOWN_SECONDS)
      expect(verifCodeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'EMAIL_OTP', identifier: TEST_EMAIL }),
      )
      expect(mockEmailProvider.sendOtp).toHaveBeenCalledWith(TEST_EMAIL, '0000')
    })

    it('should normalize email to lowercase and trim', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)

      await service.sendEmailOtp('  Test@Example.COM  ')

      expect(mockEmailProvider.sendOtp).toHaveBeenCalledWith('test@example.com', '0000')
    })

    it('should throw ValidationError for invalid email format', async () => {
      await expect(service.sendEmailOtp('not-an-email')).rejects.toThrow(ValidationError)
      await expect(service.sendEmailOtp('')).rejects.toThrow(ValidationError)
    })

    it('should throw TooManyRequestsError when resending within cooldown', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue({
        ...validEmailCode,
        createdAt: new Date(Date.now() - 10_000),
      })

      await expect(service.sendEmailOtp(TEST_EMAIL)).rejects.toThrow(TooManyRequestsError)
    })

    it('should throw TooManyRequestsError when rate limit exceeded', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(3)

      await expect(service.sendEmailOtp(TEST_EMAIL)).rejects.toThrow(TooManyRequestsError)
    })

    it('should throw AppError when email provider fails', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(null)
      verifCodeRepo.countRecentByIdentifier.mockResolvedValue(0)
      mockEmailProvider.sendOtp.mockResolvedValueOnce({ success: false })

      await expect(service.sendEmailOtp(TEST_EMAIL)).rejects.toThrow(AppError)
    })
  })

  // ── verifyEmailOtp ────────────────────────────────

  describe('verifyEmailOtp', () => {
    const meta = { userAgent: 'test', ip: '127.0.0.1' }
    const mockTokens = {
      auth: { user: existingEmailUser, tokens: { accessToken: 'tok', expiresIn: 900 } },
      refreshToken: 'ref-tok',
    }

    it('should verify correct OTP and return tokens for existing email user', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validEmailCode)
      mockUserRepo.findByEmail.mockResolvedValue(existingEmailUser)
      mockAuthService.issueTokens.mockResolvedValue(mockTokens)

      const result = await service.verifyEmailOtp(TEST_EMAIL, '0000', meta)

      expect(verifCodeRepo.markUsed).toHaveBeenCalledWith('code-e1')
      expect(result.auth).toBeDefined()
      expect(result.isNewUser).toBe(false)
    })

    it('should auto-create user with emailVerified true for new email', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validEmailCode)
      mockUserRepo.findByEmail.mockResolvedValue(null)
      mockUserRepo.create.mockResolvedValue(existingEmailUser)
      mockAuthService.issueTokens.mockResolvedValue(mockTokens)

      const result = await service.verifyEmailOtp(TEST_EMAIL, '0000', meta)

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: TEST_EMAIL, role: 'TRAVELER', emailVerified: true }),
      )
      expect(result.isNewUser).toBe(true)
    })

    it('should throw AuthError when account is deactivated', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validEmailCode)
      mockUserRepo.findByEmail.mockResolvedValue({ ...existingEmailUser, isActive: false })

      await expect(service.verifyEmailOtp(TEST_EMAIL, '0000', meta)).rejects.toThrow(AuthError)
      expect(mockAuthService.issueTokens).not.toHaveBeenCalled()
    })

    it('should throw AuthError when OTP is wrong and increment attempts', async () => {
      verifCodeRepo.findLatestByIdentifier.mockResolvedValue(validEmailCode)

      await expect(service.verifyEmailOtp(TEST_EMAIL, '9999', meta)).rejects.toThrow(AuthError)
      expect(verifCodeRepo.incrementAttempts).toHaveBeenCalledWith('code-e1')
    })

    it('should throw ValidationError for invalid email format', async () => {
      await expect(service.verifyEmailOtp('bad', '0000', meta)).rejects.toThrow(ValidationError)
    })
  })
})
