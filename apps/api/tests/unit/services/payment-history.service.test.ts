import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { PaymentHistoryService } from '../../../src/services/payment-history.service'
import { logger } from '../../../src/utils/logger'
import { PAYMENT_TYPE, PAYMENT_STATUS, BOOKING_STATUS } from '@shared/constants'

// ─── Mock repositories ──────────────────────────────
const mockPaymentTxRepo = {
  findByUserId: vi.fn(),
  findByTripId: vi.fn(),
  findAll: vi.fn(),
  getUserSummary: vi.fn(),
  getTripSummary: vi.fn(),
  getGlobalSummary: vi.fn(),
  findSafePayReleasesForOrganizer: vi.fn(),
  findPendingSafePayForOrganizer: vi.fn(),
}

const mockTripRepo = {
  findById: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

let service: PaymentHistoryService

beforeEach(() => {
  vi.clearAllMocks()
  service = new PaymentHistoryService(
    mockPaymentTxRepo as any,
    mockTripRepo as any,
    mockOrganizerProfileRepo as any,
    logger as any,
  )
})

// ─── Test data factories ─────────────────────────────
function makePaymentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pt_1',
    type: PAYMENT_TYPE.PAYMENT,
    status: PAYMENT_STATUS.CAPTURED,
    amount: 4500,
    currency: 'INR',
    razorpayPaymentId: 'pay_123',
    razorpayRefundId: null,
    failureReason: null,
    createdAt: new Date('2025-01-15'),
    booking: {
      id: 'bk_1',
      bookingRef: 'TRP-2025-0001',
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      totalAmount: 4500,
      trip: {
        id: 'trip_1',
        title: 'Goa Beach Getaway',
        slug: 'goa-beach-getaway',
        destination: { name: 'Goa' },
      },
      user: { id: 'user_1', name: 'Priya S', email: 'priya@test.com' },
    },
    ...overrides,
  }
}

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip_1',
    title: 'Goa Beach Getaway',
    organizerId: 'org_profile_1',
    ...overrides,
  }
}

function makeOrganizerProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org_profile_1',
    userId: 'organizer_1',
    businessName: 'TripVibes',
    commissionRate: 10.0,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────

describe('PaymentHistoryService', () => {
  describe('getMyPayments', () => {
    it('should return paginated payment list for user', async () => {
      const items = [makePaymentItem(), makePaymentItem({ id: 'pt_2' })]
      mockPaymentTxRepo.findByUserId.mockResolvedValue({ data: items, total: 2 })

      const result = await service.getMyPayments('user_1', { page: 1, limit: 20 })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.totalPages).toBe(1)
      expect(mockPaymentTxRepo.findByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.any(Object),
        { skip: 0, take: 20 },
      )
    })

    it('should return empty list when user has no payments', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getMyPayments('user_1', {})

      expect(result.data).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })

    it('should pass type filter to repository', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      await service.getMyPayments('user_1', { type: PAYMENT_TYPE.REFUND })

      expect(mockPaymentTxRepo.findByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ type: PAYMENT_TYPE.REFUND }),
        expect.any(Object),
      )
    })

    it('should calculate correct pagination offset for page 2', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      await service.getMyPayments('user_1', { page: 2, limit: 10 })

      expect(mockPaymentTxRepo.findByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.any(Object),
        { skip: 10, take: 10 },
      )
    })
  })

  describe('getMyPaymentSummary', () => {
    it('should return summary with correct totals', async () => {
      mockPaymentTxRepo.getUserSummary.mockResolvedValue({
        totalPaid: 9000,
        totalRefunded: 4500,
        pendingRefunds: 500,
        transactionCount: 5,
      })

      const result = await service.getMyPaymentSummary('user_1')

      expect(result.totalPaid).toBe(9000)
      expect(result.totalRefunded).toBe(4500)
      expect(result.pendingRefunds).toBe(500)
      expect(result.transactionCount).toBe(5)
    })

    it('should return zeros when user has no transactions', async () => {
      mockPaymentTxRepo.getUserSummary.mockResolvedValue({
        totalPaid: 0, totalRefunded: 0, pendingRefunds: 0, transactionCount: 0,
      })

      const result = await service.getMyPaymentSummary('user_1')

      expect(result.totalPaid).toBe(0)
      expect(result.transactionCount).toBe(0)
    })
  })

  describe('getTripPayments', () => {
    it('should return trip payments when user is the organizer', async () => {
      const trip = makeTrip()
      const profile = makeOrganizerProfile()
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)
      mockPaymentTxRepo.findByTripId.mockResolvedValue({
        data: [makePaymentItem()], total: 1,
      })

      const result = await service.getTripPayments('organizer_1', 'trip_1', {})

      expect(result.data).toHaveLength(1)
      expect(mockPaymentTxRepo.findByTripId).toHaveBeenCalledWith(
        'trip_1',
        expect.any(Object),
        expect.any(Object),
      )
    })

    it('should throw ForbiddenError when user is NOT the organizer', async () => {
      const trip = makeTrip()
      const profile = makeOrganizerProfile({ id: 'other_profile' })
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)

      await expect(
        service.getTripPayments('wrong_user', 'trip_1', {}),
      ).rejects.toThrow('You can only manage your own trips')
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockTripRepo.findById.mockResolvedValue(null)

      await expect(
        service.getTripPayments('organizer_1', 'nonexistent', {}),
      ).rejects.toThrow('Trip not found')
    })

    it('should throw ForbiddenError when organizer profile not found', async () => {
      const trip = makeTrip()
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.getTripPayments('organizer_1', 'trip_1', {}),
      ).rejects.toThrow('Organizer profile not found')
    })
  })

  describe('getTripPaymentSummary', () => {
    it('should return summary with commission calculation', async () => {
      const trip = makeTrip()
      const profile = makeOrganizerProfile({ commissionRate: 10.0 })
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)
      mockPaymentTxRepo.getTripSummary.mockResolvedValue({
        totalRevenue: 45000, totalRefunded: 4500,
        transactionCount: 12, refundCount: 1,
      })

      const result = await service.getTripPaymentSummary('organizer_1', 'trip_1')

      expect(result.totalRevenue).toBe(45000)
      expect(result.totalRefunded).toBe(4500)
      expect(result.netRevenue).toBe(40500)
      expect(result.platformCommission).toBe(4050)
      expect(result.organizerEarnings).toBe(36450)
    })

    it('should throw ForbiddenError for non-organizer', async () => {
      const trip = makeTrip()
      const profile = makeOrganizerProfile({ id: 'other_profile' })
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)

      await expect(
        service.getTripPaymentSummary('wrong_user', 'trip_1'),
      ).rejects.toThrow('You can only manage your own trips')
    })

    it('should handle zero transactions', async () => {
      const trip = makeTrip()
      const profile = makeOrganizerProfile()
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)
      mockPaymentTxRepo.getTripSummary.mockResolvedValue({
        totalRevenue: 0, totalRefunded: 0, transactionCount: 0, refundCount: 0,
      })

      const result = await service.getTripPaymentSummary('organizer_1', 'trip_1')

      expect(result.netRevenue).toBe(0)
      expect(result.platformCommission).toBe(0)
      expect(result.organizerEarnings).toBe(0)
    })
  })

  describe('getAllPayments', () => {
    it('should return all payments for admin', async () => {
      mockPaymentTxRepo.findAll.mockResolvedValue({
        data: [makePaymentItem()], total: 1,
      })

      const result = await service.getAllPayments({})

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should pass all admin filters to repository', async () => {
      mockPaymentTxRepo.findAll.mockResolvedValue({ data: [], total: 0 })

      await service.getAllPayments({
        type: PAYMENT_TYPE.PAYMENT, userId: 'user_1', bookingRef: 'TRP',
      })

      expect(mockPaymentTxRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ type: PAYMENT_TYPE.PAYMENT, userId: 'user_1', bookingRef: 'TRP' }),
        expect.any(Object),
      )
    })

    it('should return empty list when no payments exist', async () => {
      mockPaymentTxRepo.findAll.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getAllPayments({})

      expect(result.data).toHaveLength(0)
      expect(result.pagination.totalPages).toBe(0)
    })
  })

  describe('getPayoutStatement', () => {
    function makeSafePayRelease(overrides: Record<string, unknown> = {}) {
      return {
        id: 'pt_safepay_1',
        amount: 9000,
        razorpayTransferId: 'tr_001',
        metadata: { releasedAt: '2025-06-01T10:00:00.000Z' },
        createdAt: new Date('2025-06-01'),
        booking: {
          trip: {
            id: 'trip_1',
            title: 'Goa Beach Getaway',
            slug: 'goa-beach-getaway',
            startDate: new Date('2025-05-01'),
            organizer: { commissionRate: 10.0 },
          },
        },
        ...overrides,
      }
    }

    function makePendingPayment(overrides: Record<string, unknown> = {}) {
      return {
        id: 'pt_pending_1',
        amount: 5000,
        booking: {
          trip: {
            organizer: { commissionRate: 10.0 },
          },
        },
        ...overrides,
      }
    }

    it('throws ForbiddenError when organizer profile not found', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.getPayoutStatement('unknown_user'))
        .rejects.toThrow('Organizer profile not found')
    })

    it('returns empty trips and zero totals when no releases exist', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([])

      const result = await service.getPayoutStatement('organizer_1')

      expect(result.releasedTotal).toBe(0)
      expect(result.pendingTotal).toBe(0)
      expect(result.trips).toHaveLength(0)
    })

    it('groups releases by trip correctly', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([
        makeSafePayRelease({ id: 'pt_1', amount: 4000 }),
        makeSafePayRelease({ id: 'pt_2', amount: 5000 }),
      ])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([])

      const result = await service.getPayoutStatement('organizer_1')

      expect(result.trips).toHaveLength(1) // both are for trip_1
      expect(result.trips[0].tripId).toBe('trip_1')
      expect(result.trips[0].payouts).toHaveLength(2)
    })

    it('calculates releasedTotal as sum of all release amounts', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([
        makeSafePayRelease({ amount: 4000 }),
        makeSafePayRelease({ id: 'pt_2', amount: 6000 }),
      ])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([])

      const result = await service.getPayoutStatement('organizer_1')

      expect(result.releasedTotal).toBe(10000)
    })

    it('calculates pendingTotal after deducting commission', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([])
      // 10000 * (1 - 10%) = 9000
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([
        makePendingPayment({ amount: 10000 }),
      ])

      const result = await service.getPayoutStatement('organizer_1')

      expect(result.pendingTotal).toBe(9000)
    })

    it('groups releases from two different trips into separate trip entries', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([
        makeSafePayRelease({ id: 'pt_1', amount: 4000 }),
        makeSafePayRelease({
          id: 'pt_2', amount: 3000,
          booking: {
            trip: {
              id: 'trip_2', title: 'Manali Snow Trek', slug: 'manali-snow-trek',
              startDate: new Date('2025-07-01'), organizer: { commissionRate: 10.0 },
            },
          },
        }),
      ])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([])

      const result = await service.getPayoutStatement('organizer_1')

      expect(result.trips).toHaveLength(2)
      expect(result.releasedTotal).toBe(7000)
    })

    it('uses metadata.releasedAt when available', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      const releasedAt = '2025-06-15T08:00:00.000Z'
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([
        makeSafePayRelease({ metadata: { releasedAt } }),
      ])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([])

      const result = await service.getPayoutStatement('organizer_1')

      expect(result.trips[0].payouts[0].releasedAt).toBe(releasedAt)
    })
  })

  describe('getGlobalSummary', () => {
    it('should return global admin summary with commission', async () => {
      mockPaymentTxRepo.getGlobalSummary.mockResolvedValue({
        totalRevenue: 500000, totalRefunded: 25000,
        transactionCount: 200, failedCount: 3,
      })

      const result = await service.getGlobalSummary()

      expect(result.totalRevenue).toBe(500000)
      expect(result.totalRefunded).toBe(25000)
      expect(result.netRevenue).toBe(475000)
      expect(result.totalCommission).toBe(47500)
      expect(result.transactionCount).toBe(200)
      expect(result.failedCount).toBe(3)
    })

    it('should return zeros when no transactions exist', async () => {
      mockPaymentTxRepo.getGlobalSummary.mockResolvedValue({
        totalRevenue: 0, totalRefunded: 0, transactionCount: 0, failedCount: 0,
      })

      const result = await service.getGlobalSummary()

      expect(result.totalRevenue).toBe(0)
      expect(result.netRevenue).toBe(0)
      expect(result.totalCommission).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════
  // commissionRate — Prisma.Decimal handling
  // After the Float → Decimal(5,2) migration, OrganizerProfile.commissionRate
  // is a Prisma.Decimal, not a plain JS number. The service calls Number() on it.
  // ═══════════════════════════════════════════════════════

  describe('Decimal commissionRate in getTripPaymentSummary', () => {
    it('correctly converts Prisma.Decimal commissionRate to a number for commission math', async () => {
      const trip = makeTrip()
      // Simulate what Prisma returns after the Float→Decimal migration
      const profile = makeOrganizerProfile({ commissionRate: new Prisma.Decimal('12.5') })
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)
      mockPaymentTxRepo.getTripSummary.mockResolvedValue({
        totalRevenue: 20000, totalRefunded: 0,
        transactionCount: 4, refundCount: 0,
      })

      const result = await service.getTripPaymentSummary('organizer_1', 'trip_1')

      // 20000 * 12.5% = 2500 commission
      expect(result.platformCommission).toBe(2500)
      expect(result.organizerEarnings).toBe(17500)
    })

    it('falls back to DEFAULT_COMMISSION_RATE (10%) when commissionRate is null', async () => {
      const trip = makeTrip()
      const profile = makeOrganizerProfile({ commissionRate: null })
      mockTripRepo.findById.mockResolvedValue(trip)
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(profile)
      mockPaymentTxRepo.getTripSummary.mockResolvedValue({
        totalRevenue: 10000, totalRefunded: 0,
        transactionCount: 2, refundCount: 0,
      })

      const result = await service.getTripPaymentSummary('organizer_1', 'trip_1')

      // null → 10% default → 10000 * 10% = 1000
      expect(result.platformCommission).toBe(1000)
      expect(result.organizerEarnings).toBe(9000)
    })
  })

  describe('Decimal commissionRate in getPayoutStatement (pendingTotal)', () => {
    it('correctly converts Prisma.Decimal commissionRate when calculating pending SafePay', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([
        {
          id: 'pt_1',
          amount: 10000,
          booking: {
            trip: {
              organizer: { commissionRate: new Prisma.Decimal('15.00') },
            },
          },
        },
      ])

      const result = await service.getPayoutStatement('organizer_1')

      // 10000 * (1 - 0.15) = 8500
      expect(result.pendingTotal).toBe(8500)
    })

    it('falls back to DEFAULT_COMMISSION_RATE when pending payment commissionRate is null', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(makeOrganizerProfile())
      mockPaymentTxRepo.findSafePayReleasesForOrganizer.mockResolvedValue([])
      mockPaymentTxRepo.findPendingSafePayForOrganizer.mockResolvedValue([
        {
          id: 'pt_1',
          amount: 5000,
          booking: {
            trip: {
              organizer: { commissionRate: null },
            },
          },
        },
      ])

      const result = await service.getPayoutStatement('organizer_1')

      // null → 10% default → 5000 * (1 - 0.10) = 4500
      expect(result.pendingTotal).toBe(4500)
    })
  })

  describe('annotatePartialRefund (via getMyPayments)', () => {
    it('sets isPartialRefund=false for PAYMENT type', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({
        data: [makePaymentItem({ type: PAYMENT_TYPE.PAYMENT, amount: 4500 })],
        total: 1,
      })
      const result = await service.getMyPayments('user_1', {})
      expect(result.data[0].isPartialRefund).toBe(false)
    })

    it('sets isPartialRefund=false for full REFUND (amount equals totalAmount)', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({
        data: [makePaymentItem({ type: PAYMENT_TYPE.REFUND, amount: 4500, booking: { id: 'bk_1', bookingRef: 'TRP-2025-0001', bookingStatus: BOOKING_STATUS.CONFIRMED, totalAmount: 4500, trip: { id: 'trip_1', title: 'Goa Beach Getaway', slug: 'goa-beach-getaway', destination: { name: 'Goa' } }, user: { id: 'user_1', name: 'Priya S', email: 'priya@test.com' } } })],
        total: 1,
      })
      const result = await service.getMyPayments('user_1', {})
      expect(result.data[0].isPartialRefund).toBe(false)
    })

    it('sets isPartialRefund=true for REFUND with amount less than totalAmount', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({
        data: [makePaymentItem({ type: PAYMENT_TYPE.REFUND, amount: 2000, booking: { id: 'bk_1', bookingRef: 'TRP-2025-0001', bookingStatus: BOOKING_STATUS.CONFIRMED, totalAmount: 4500, trip: { id: 'trip_1', title: 'Goa Beach Getaway', slug: 'goa-beach-getaway', destination: { name: 'Goa' } }, user: { id: 'user_1', name: 'Priya S', email: 'priya@test.com' } } })],
        total: 1,
      })
      const result = await service.getMyPayments('user_1', {})
      expect(result.data[0].isPartialRefund).toBe(true)
    })

    it('sets isPartialRefund=false for ESCROW_RELEASE type', async () => {
      mockPaymentTxRepo.findByUserId.mockResolvedValue({
        data: [makePaymentItem({ type: PAYMENT_TYPE.ESCROW_RELEASE, amount: 4500 })],
        total: 1,
      })
      const result = await service.getMyPayments('user_1', {})
      expect(result.data[0].isPartialRefund).toBe(false)
    })
  })
})
