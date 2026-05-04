import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FirebaseAuthService } from '../../../src/services/firebase-auth.service'
import { AuthError } from '../../../src/errors/app-error'

// ── Mocks ────────────────────────────────────────────

const mockUserRepo = { findByPhone: vi.fn(), create: vi.fn() }
const mockAuthService = { issueTokens: vi.fn() }
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any

const mockFirebaseAuth = {
  verifyIdToken: vi.fn(),
}

const existingUser = {
  id: 'user-1', name: 'Test', email: null, phone: '9876543210',
  role: 'TRAVELER', avatarUrl: null, isActive: true, phoneVerified: true,
}

const mockTokens = {
  auth: { user: existingUser, tokens: { accessToken: 'tok', expiresIn: 900 } },
  refreshToken: 'ref-tok',
}

const meta = { userAgent: 'test', ip: '127.0.0.1' }

// ── Tests ────────────────────────────────────────────

describe('FirebaseAuthService', () => {
  let service: FirebaseAuthService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new FirebaseAuthService(
      mockFirebaseAuth as any,
      mockUserRepo as any,
      mockAuthService as any,
      mockLogger,
    )
  })

  it('should verify valid token and return tokens for existing user', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({ phone_number: '+919876543210' })
    mockUserRepo.findByPhone.mockResolvedValue(existingUser)
    mockAuthService.issueTokens.mockResolvedValue(mockTokens)

    const result = await service.verifyPhoneToken('valid-id-token', meta)

    expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith('valid-id-token')
    expect(mockUserRepo.findByPhone).toHaveBeenCalledWith('9876543210')
    expect(result.auth).toBeDefined()
    expect(result.isNewUser).toBe(false)
  })

  it('should auto-create user with TRAVELER role for new phone', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({ phone_number: '+919876543210' })
    mockUserRepo.findByPhone.mockResolvedValue(null)
    mockUserRepo.create.mockResolvedValue(existingUser)
    mockAuthService.issueTokens.mockResolvedValue(mockTokens)

    const result = await service.verifyPhoneToken('valid-id-token', meta)

    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '9876543210', role: 'TRAVELER', phoneVerified: true }),
    )
    expect(result.isNewUser).toBe(true)
  })

  it('should throw AuthError when token verification fails', async () => {
    mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('invalid token'))

    await expect(service.verifyPhoneToken('bad-token', meta)).rejects.toThrow(AuthError)
    await expect(service.verifyPhoneToken('bad-token', meta)).rejects.toThrow('Invalid Firebase token')
  })

  it('should throw AuthError when token has no phone number', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({ email: 'test@test.com' })

    await expect(service.verifyPhoneToken('token-no-phone', meta)).rejects.toThrow(AuthError)
    await expect(service.verifyPhoneToken('token-no-phone', meta)).rejects.toThrow('No phone number in Firebase token')
  })

  it('should throw AuthError when user account is deactivated', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({ phone_number: '+919876543210' })
    mockUserRepo.findByPhone.mockResolvedValue({ ...existingUser, isActive: false })

    await expect(service.verifyPhoneToken('valid-id-token', meta)).rejects.toThrow(AuthError)
    await expect(service.verifyPhoneToken('valid-id-token', meta)).rejects.toThrow('Account is deactivated')
    expect(mockAuthService.issueTokens).not.toHaveBeenCalled()
  })

  it('should throw AuthError when phone number format is invalid', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({ phone_number: '+1234' })

    await expect(service.verifyPhoneToken('token', meta)).rejects.toThrow(AuthError)
    await expect(service.verifyPhoneToken('token', meta)).rejects.toThrow('Invalid phone number in Firebase token')
  })
})
