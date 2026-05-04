import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentHistoryService } from '../../../src/services/payment-history.service'
import { logger } from '../../../src/utils/logger'

// ─── Mock repositories ──────────────────────────────
const mockPaymentTxRepo = {
  findByUserId: vi.fn(),
  findByTripId: vi.fn(),
  findAll: vi.fn(),
  getUserSummary: vi.fn(),
  getTripSummary: vi.fn(),
  getGlobalSummary: vi.fn(),
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
    type: 'PAYMENT',
    status: 'CAPTURED',
    amount: 4500,
    currency: 'INR',
    razorpayPaymentId: 'pay_123',
    razorpayRefundId: null,
    failureReason: null,
    createdAt: new Date('2025-01-15'),
    booking: {
      id: 'bk_1',
      bookingRef: 'TRP-2025-0001',
      bookingStatus: 'CONFIRMED',
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

      await service.getMyPayments('user_1', { type: 'REFUND' })

      expect(mockPaymentTxRepo.findByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ type: 'REFUND' }),
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
        type: 'PAYMENT', userId: 'user_1', bookingRef: 'TRP',
      })

      expect(mockPaymentTxRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PAYMENT', userId: 'user_1', bookingRef: 'TRP' }),
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
})
