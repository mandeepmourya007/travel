/**
 * Full Organizer Lifecycle Tests
 *
 * Tests the complete organizer signup journey:
 *   1. Signup (email + password) → user created as TRAVELER
 *   2. Onboarding → role changed to ORGANIZER, OrganizerProfile auto-created (PENDING)
 *   3. Profile check → verificationStatus=PENDING, bankAccountLinked=false
 *   4. Admin approval → verificationStatus=APPROVED
 *   5. Bank account linking → bankAccountLinked=true, razorpayAccountId set
 *   6. Edge cases: duplicate bank link, missing profile, already approved
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { AuthService } from '../../../src/services/auth.service'
import { AdminService } from '../../../src/services/admin.service'
import { ConflictError, NotFoundError } from '../../../src/errors/app-error'

// ── Shared constants ────────────────────────────────
const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
const meta = { userAgent: 'test-agent', ip: '127.0.0.1' }

// ── Mock factories ──────────────────────────────────

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByGoogleId: vi.fn(),
    create: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn(),
    updateGoogleId: vi.fn(),
    emailExists: vi.fn(),
    findWithOrganizer: vi.fn(),
    countAll: vi.fn(),
    countByRole: vi.fn(),
  }
}

function createMockRefreshTokenRepo() {
  return {
    create: vi.fn(),
    findByHash: vi.fn(),
    revokeByHash: vi.fn(),
    revokeByFamily: vi.fn(),
    revokeAllForUser: vi.fn(),
    deleteExpired: vi.fn(),
  }
}

function createMockOrganizerProfileRepo() {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    incrementTripCount: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
    findAllAdmin: vi.fn(),
    findByIdAdmin: vi.fn(),
    countPending: vi.fn(),
    updateWhereBankNotLinked: vi.fn(),
  }
}

function createMockWalletRepo() {
  return {
    create: vi.fn(),
    findByUserId: vi.fn(),
    findOrCreate: vi.fn(),
    getCashbackByUser: vi.fn(),
    getCashbackByTrip: vi.fn(),
    getCashbackForUserDetail: vi.fn(),
  }
}

function createMockLoginAttemptTracker() {
  return {
    isLocked: vi.fn().mockResolvedValue(0),
    recordFailure: vi.fn().mockResolvedValue({ locked: false, remainingAttempts: 4 }),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
  }
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as import('pino').Logger

const mockNotificationService = {
  send: vi.fn().mockResolvedValue([{ channel: 'IN_APP', success: true }]),
}

// ── Test data ───────────────────────────────────────

const TRAVELER_USER = {
  id: 'user-org-1',
  name: 'User',
  email: 'organizer@example.com' as string | null,
  role: 'TRAVELER' as const,
  isActive: true,
  avatarUrl: null,
  passwordHash: '$2b$12$hashedpassword',
  googleId: null as string | null,
  phone: '9876543210' as string | null,
  phoneVerified: false,
  aadhaarVerified: false,
}

const ORGANIZER_USER = {
  ...TRAVELER_USER,
  name: 'Rahul Sharma',
  role: 'ORGANIZER' as const,
}

const ORGANIZER_PROFILE = {
  id: 'orgp-1',
  userId: 'user-org-1',
  businessName: 'Rahul Sharma',
  slug: 'rahul-sharma',
  description: null,
  verificationStatus: 'PENDING' as const,
  bankAccountLinked: false,
  razorpayAccountId: null as string | null,
  documents: null as Record<string, string> | null,
  rating: 0,
  totalReviews: 0,
  totalTripsCompleted: 0,
  commissionRate: 10.0,
  isActive: true,
  isDeleted: false,
  createdAt: new Date('2026-05-17'),
  updatedAt: new Date('2026-05-17'),
}

const BANK_DTO = {
  accountHolderName: 'Rahul Sharma',
  ifscCode: 'SBIN0001234',
  accountNumber: '12345678901234',
  beneficiaryName: 'Rahul Sharma',
}

// ═════════════════════════════════════════════════════
// FULL ORGANIZER LIFECYCLE
// ═════════════════════════════════════════════════════
describe('Organizer Lifecycle — Full Signup Flow', () => {
  let authService: AuthService
  let adminService: AdminService
  let userRepo: ReturnType<typeof createMockUserRepo>
  let refreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>
  let organizerProfileRepo: ReturnType<typeof createMockOrganizerProfileRepo>
  let walletRepo: ReturnType<typeof createMockWalletRepo>

  beforeEach(() => {
    vi.clearAllMocks()
    userRepo = createMockUserRepo()
    refreshTokenRepo = createMockRefreshTokenRepo()
    organizerProfileRepo = createMockOrganizerProfileRepo()
    walletRepo = createMockWalletRepo()
    const loginAttemptTracker = createMockLoginAttemptTracker()

    authService = new AuthService(
      userRepo as any,
      refreshTokenRepo as any,
      organizerProfileRepo as any,
      walletRepo as any,
      JWT_SECRET,
      mockLogger,
      'test-google-client-id',
      loginAttemptTracker as any,
    )

    adminService = new AdminService(
      organizerProfileRepo as any,
      userRepo as any,
      { countByStatusAdmin: vi.fn(), getRevenueTrend: vi.fn(), findAllAdmin: vi.fn(), findByIdAdmin: vi.fn(), findConfirmedByTripForCashback: vi.fn() } as any,
      { countByStatus: vi.fn(), countByType: vi.fn(), findById: vi.fn(), findCompletedTripsForCashback: vi.fn() } as any,
      { getGlobalSummary: vi.fn() } as any,
      { countFlagged: vi.fn() } as any,
      walletRepo as any,
      { credit: vi.fn() } as any,
      mockLogger as any,
      mockNotificationService as any,
    )
  })

  // ── Step 1: Signup ────────────────────────────────

  describe('Step 1 — Signup with email + password', () => {
    it('creates user as TRAVELER (default role)', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(TRAVELER_USER)
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await authService.signup(
        { email: 'organizer@example.com', password: 'Password1' },
        meta,
      )

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'organizer@example.com', role: 'TRAVELER' }),
      )
      expect(result.auth.user.role).toBe('TRAVELER')
      expect(result.auth.tokens.accessToken).toBeDefined()
    })

    it('does NOT create OrganizerProfile during signup (role=TRAVELER)', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(TRAVELER_USER)
      refreshTokenRepo.create.mockResolvedValue({})

      await authService.signup(
        { email: 'organizer@example.com', password: 'Password1' },
        meta,
      )

      expect(organizerProfileRepo.create).not.toHaveBeenCalled()
    })

    it('creates wallet for the new user', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(TRAVELER_USER)
      refreshTokenRepo.create.mockResolvedValue({})

      await authService.signup(
        { email: 'organizer@example.com', password: 'Password1' },
        meta,
      )

      expect(walletRepo.create).toHaveBeenCalledWith('user-org-1')
    })
  })

  // ── Step 2: Onboarding (role → ORGANIZER) ─────────

  describe('Step 2 — Onboarding: set name + select ORGANIZER role', () => {
    it('updates name and role, returns new JWT with ORGANIZER claim', async () => {
      userRepo.findById.mockResolvedValue(TRAVELER_USER)
      userRepo.updateProfile.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.findByUserId.mockResolvedValue(null)
      organizerProfileRepo.create.mockResolvedValue(ORGANIZER_PROFILE)

      const result = await authService.updateProfile('user-org-1', {
        name: 'Rahul Sharma',
        role: 'ORGANIZER',
      })

      expect(result.name).toBe('Rahul Sharma')
      expect(result.role).toBe('ORGANIZER')
      expect(result.accessToken).toBeDefined()

      const decoded = jwt.verify(result.accessToken!, JWT_SECRET) as { role: string }
      expect(decoded.role).toBe('ORGANIZER')
    })

    it('auto-creates OrganizerProfile with PENDING status', async () => {
      userRepo.findById.mockResolvedValue(TRAVELER_USER)
      userRepo.updateProfile.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.findByUserId.mockResolvedValue(null)
      organizerProfileRepo.create.mockResolvedValue(ORGANIZER_PROFILE)

      await authService.updateProfile('user-org-1', {
        name: 'Rahul Sharma',
        role: 'ORGANIZER',
      })

      expect(organizerProfileRepo.create).toHaveBeenCalledWith({
        user: { connect: { id: 'user-org-1' } },
        businessName: 'Rahul Sharma',
        slug: 'rahul-sharma',
      })
    })

    it('does NOT duplicate OrganizerProfile if already exists', async () => {
      userRepo.findById.mockResolvedValue(TRAVELER_USER)
      userRepo.updateProfile.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.findByUserId.mockResolvedValue(ORGANIZER_PROFILE)

      await authService.updateProfile('user-org-1', {
        name: 'Rahul Sharma',
        role: 'ORGANIZER',
      })

      expect(organizerProfileRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── Step 3: Profile shows PENDING + bank not linked ─

  describe('Step 3 — Profile reflects PENDING verification + no bank', () => {
    it('getFullProfile returns verificationStatus=PENDING and bankAccountLinked=false', async () => {
      userRepo.findWithOrganizer.mockResolvedValue({
        ...ORGANIZER_USER,
        createdAt: new Date('2026-05-17'),
        organizerProfile: ORGANIZER_PROFILE,
      })

      const profile = await authService.getFullProfile('user-org-1')

      expect(profile.role).toBe('ORGANIZER')
      expect(profile.organizerProfile).not.toBeNull()
      expect(profile.organizerProfile!.verificationStatus).toBe('PENDING')
      expect(profile.organizerProfile!.bankAccountLinked).toBe(false)
    })
  })

  // ── Step 4: Admin Approval ────────────────────────

  describe('Step 4 — Admin approves organizer', () => {
    it('changes verificationStatus from PENDING to APPROVED', async () => {
      organizerProfileRepo.findById.mockResolvedValue(ORGANIZER_PROFILE)
      organizerProfileRepo.update.mockResolvedValue({
        ...ORGANIZER_PROFILE,
        verificationStatus: 'APPROVED',
      })

      const result = await adminService.approveOrReject('orgp-1', { action: 'APPROVED' })

      expect(result.status).toBe('APPROVED')
      expect(organizerProfileRepo.update).toHaveBeenCalledWith('orgp-1', {
        verificationStatus: 'APPROVED',
      })
    })

    it('sends ORGANIZER_APPROVED notification to organizer', async () => {
      organizerProfileRepo.findById.mockResolvedValue(ORGANIZER_PROFILE)
      organizerProfileRepo.update.mockResolvedValue({
        ...ORGANIZER_PROFILE,
        verificationStatus: 'APPROVED',
      })

      await adminService.approveOrReject('orgp-1', { action: 'APPROVED' })

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-org-1',
          type: 'ORGANIZER_APPROVED',
        }),
      )
    })

    it('admin can reject with reason', async () => {
      organizerProfileRepo.findById.mockResolvedValue(ORGANIZER_PROFILE)
      organizerProfileRepo.update.mockResolvedValue({
        ...ORGANIZER_PROFILE,
        verificationStatus: 'REJECTED',
      })

      const result = await adminService.approveOrReject('orgp-1', {
        action: 'REJECTED',
        reason: 'Documents unclear',
      })

      expect(result.status).toBe('REJECTED')
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ORGANIZER_REJECTED',
          body: expect.stringContaining('Documents unclear'),
        }),
      )
    })
  })

  // ── Step 5: Bank Account Linking ──────────────────

  describe('Step 5 — Connect bank account', () => {
    it('links bank account and returns masked account number', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(ORGANIZER_PROFILE)
      userRepo.findById.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.updateWhereBankNotLinked.mockResolvedValue({ count: 1 })

      const result = await authService.connectBankAccount('user-org-1', BANK_DTO)

      expect(result.bankAccountLinked).toBe(true)
      expect(result.maskedAccountNumber).toBe('**********1234')
    })

    it('stores razorpayAccountId and sets bankAccountLinked=true', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(ORGANIZER_PROFILE)
      userRepo.findById.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.updateWhereBankNotLinked.mockResolvedValue({ count: 1 })

      await authService.connectBankAccount('user-org-1', BANK_DTO)

      expect(organizerProfileRepo.updateWhereBankNotLinked).toHaveBeenCalledWith('orgp-1', {
        razorpayAccountId: expect.stringContaining('acc_mock_'),
        bankAccountLinked: true,
      })
    })

    it('masks account number correctly (last 4 visible)', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(ORGANIZER_PROFILE)
      userRepo.findById.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.updateWhereBankNotLinked.mockResolvedValue({ count: 1 })

      const result = await authService.connectBankAccount('user-org-1', {
        ...BANK_DTO,
        accountNumber: '987654321',
      })

      expect(result.maskedAccountNumber).toBe('*****4321')
    })

    it('logs the bank linking event', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(ORGANIZER_PROFILE)
      userRepo.findById.mockResolvedValue(ORGANIZER_USER)
      organizerProfileRepo.updateWhereBankNotLinked.mockResolvedValue({ count: 1 })

      await authService.connectBankAccount('user-org-1', BANK_DTO)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-org-1', profileId: 'orgp-1' }),
        'Bank account linked via Razorpay Route',
      )
    })
  })

  // ── Step 6: Edge cases ────────────────────────────

  describe('Step 6 — Edge cases', () => {
    it('throws ConflictError if bank already linked', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue({
        ...ORGANIZER_PROFILE,
        bankAccountLinked: true,
        razorpayAccountId: 'acc_existing_123',
      })

      await expect(
        authService.connectBankAccount('user-org-1', BANK_DTO),
      ).rejects.toThrow(ConflictError)
      await expect(
        authService.connectBankAccount('user-org-1', BANK_DTO),
      ).rejects.toThrow('Bank account is already linked')
    })

    it('throws NotFoundError if organizer profile does not exist', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(
        authService.connectBankAccount('user-org-1', BANK_DTO),
      ).rejects.toThrow(NotFoundError)
    })

    it('throws NotFoundError if user does not exist', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(ORGANIZER_PROFILE)
      userRepo.findById.mockResolvedValue(null)

      await expect(
        authService.connectBankAccount('user-org-1', BANK_DTO),
      ).rejects.toThrow(NotFoundError)
    })

    it('getFullProfile shows bankAccountLinked=true after linking', async () => {
      userRepo.findWithOrganizer.mockResolvedValue({
        ...ORGANIZER_USER,
        createdAt: new Date('2026-05-17'),
        organizerProfile: {
          ...ORGANIZER_PROFILE,
          verificationStatus: 'APPROVED',
          bankAccountLinked: true,
          razorpayAccountId: 'acc_mock_123',
        },
      })

      const profile = await authService.getFullProfile('user-org-1')

      expect(profile.organizerProfile!.verificationStatus).toBe('APPROVED')
      expect(profile.organizerProfile!.bankAccountLinked).toBe(true)
    })

    it('signup with duplicate email throws ConflictError', async () => {
      userRepo.emailExists.mockResolvedValue(true)

      await expect(
        authService.signup({ email: 'organizer@example.com', password: 'Password1' }, meta),
      ).rejects.toThrow(ConflictError)
    })
  })
})
