import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripRepository } from '../../../src/repositories/trip.repository'

// ── Mock Prisma client ───────────────────────────────

function createMockPrisma() {
  return {
    paymentTransaction: {
      aggregate: vi.fn(),
    },
    tripRequest: {
      count: vi.fn(),
    },
    trip: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((args: unknown[]) => Promise.all(args)),
  }
}

// ── Tests ────────────────────────────────────────────

describe('TripRepository', () => {
  let repo: TripRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new TripRepository(mockPrisma as any)
  })

  // ── calculateOrganizerRevenue ────────────────────

  describe('calculateOrganizerRevenue', () => {
    it('should query CAPTURED PAYMENT transactions for the organizer', async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } }) // payments
        .mockResolvedValueOnce({ _sum: { amount: 5000 } }) // refunds

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(45000)
      // First call: CAPTURED PAYMENTs
      expect(mockPrisma.paymentTransaction.aggregate).toHaveBeenNthCalledWith(1, {
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: 'PAYMENT',
          booking: {
            trip: { organizerId: 'org-1', isDeleted: false },
          },
        },
      })
      // Second call: CAPTURED REFUNDs
      expect(mockPrisma.paymentTransaction.aggregate).toHaveBeenNthCalledWith(2, {
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: 'REFUND',
          booking: {
            trip: { organizerId: 'org-1', isDeleted: false },
          },
        },
      })
    })

    it('should exclude INITIATED and FAILED payments from revenue', async () => {
      // Only CAPTURED payments are queried; INITIATED/FAILED are not included
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 20000 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(20000)
      // Verify the where clause filters to status: 'CAPTURED' only
      const paymentCall = mockPrisma.paymentTransaction.aggregate.mock.calls[0][0]
      expect(paymentCall.where.status).toBe('CAPTURED')
      expect(paymentCall.where.type).toBe('PAYMENT')
    })

    it('should exclude deleted trips from revenue calculation', async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 10000 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })

      await repo.calculateOrganizerRevenue('org-1')

      // Both queries filter isDeleted: false
      const paymentWhere = mockPrisma.paymentTransaction.aggregate.mock.calls[0][0].where
      const refundWhere = mockPrisma.paymentTransaction.aggregate.mock.calls[1][0].where
      expect(paymentWhere.booking.trip.isDeleted).toBe(false)
      expect(refundWhere.booking.trip.isDeleted).toBe(false)
    })

    it('should return 0 when no payments exist (null _sum)', async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(0)
    })

    it('should subtract refunds from payments correctly', async () => {
      // ₹100,000 captured - ₹25,000 refunded = ₹75,000
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100000 } })
        .mockResolvedValueOnce({ _sum: { amount: 25000 } })

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(75000)
    })

    it('should return negative when refunds exceed payments', async () => {
      // Possible after price adjustments + full refunds
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 12000 } })

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(-7000)
    })

    it('should handle full refund scenario (revenue = 0)', async () => {
      // All bookings cancelled and fully refunded
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 45000 } })
        .mockResolvedValueOnce({ _sum: { amount: 45000 } })

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(0)
    })

    it('should handle payments with no refunds', async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 80000 } })
        .mockResolvedValueOnce({ _sum: { amount: null } }) // no refunds at all

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(80000)
    })

    it('should not include ESCROW_RELEASE transactions in revenue', async () => {
      mockPrisma.paymentTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } })

      await repo.calculateOrganizerRevenue('org-1')

      // Verify first call uses type: 'PAYMENT' (not ESCROW_RELEASE)
      const paymentCall = mockPrisma.paymentTransaction.aggregate.mock.calls[0][0]
      expect(paymentCall.where.type).toBe('PAYMENT')
      // Verify second call uses type: 'REFUND' (not ESCROW_RELEASE)
      const refundCall = mockPrisma.paymentTransaction.aggregate.mock.calls[1][0]
      expect(refundCall.where.type).toBe('REFUND')
      // Only 2 aggregate calls — ESCROW_RELEASE is never queried
      expect(mockPrisma.paymentTransaction.aggregate).toHaveBeenCalledTimes(2)
    })
  })

  // ── countPendingRequests ─────────────────────────

  describe('countPendingRequests', () => {
    it('should count PENDING requests on non-deleted trips', async () => {
      mockPrisma.tripRequest.count.mockResolvedValue(5)

      const count = await repo.countPendingRequests('org-1')

      expect(count).toBe(5)
      expect(mockPrisma.tripRequest.count).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          isDeleted: false,
          trip: { organizerId: 'org-1', isDeleted: false },
        },
      })
    })

    it('should return 0 when no pending requests exist', async () => {
      mockPrisma.tripRequest.count.mockResolvedValue(0)

      const count = await repo.countPendingRequests('org-1')

      expect(count).toBe(0)
    })

    it('should exclude deleted trip requests', async () => {
      mockPrisma.tripRequest.count.mockResolvedValue(3)

      await repo.countPendingRequests('org-1')

      const where = mockPrisma.tripRequest.count.mock.calls[0][0].where
      expect(where.isDeleted).toBe(false)
    })

    it('should exclude requests from deleted trips', async () => {
      mockPrisma.tripRequest.count.mockResolvedValue(2)

      await repo.countPendingRequests('org-1')

      const where = mockPrisma.tripRequest.count.mock.calls[0][0].where
      expect(where.trip.isDeleted).toBe(false)
    })

    it('should only count PENDING status (not APPROVED or REJECTED)', async () => {
      mockPrisma.tripRequest.count.mockResolvedValue(1)

      await repo.countPendingRequests('org-1')

      const where = mockPrisma.tripRequest.count.mock.calls[0][0].where
      expect(where.status).toBe('PENDING')
    })
  })
})
