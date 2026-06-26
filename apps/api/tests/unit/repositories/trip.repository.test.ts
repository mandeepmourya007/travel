import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripRepository } from '../../../src/repositories/trip.repository'

// ── Mock Prisma client ───────────────────────────────

function createMockPrisma() {
  return {
    paymentTransaction: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
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
    it('should query CAPTURED PAYMENT and REFUND via single groupBy', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([
        { type: 'PAYMENT', _sum: { amount: 50000 } },
        { type: 'REFUND', _sum: { amount: 5000 } },
      ])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(45000)
      expect(mockPrisma.paymentTransaction.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: { in: ['PAYMENT', 'REFUND'] },
          booking: {
            trip: { organizerId: 'org-1', isDeleted: false },
          },
        },
      })
    })

    it('should exclude INITIATED and FAILED payments from revenue', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([
        { type: 'PAYMENT', _sum: { amount: 20000 } },
      ])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(20000)
      const call = mockPrisma.paymentTransaction.groupBy.mock.calls[0][0]
      expect(call.where.status).toBe('CAPTURED')
    })

    it('should exclude deleted trips from revenue calculation', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([])

      await repo.calculateOrganizerRevenue('org-1')

      const where = mockPrisma.paymentTransaction.groupBy.mock.calls[0][0].where
      expect(where.booking.trip.isDeleted).toBe(false)
    })

    it('should return 0 when no payments exist (empty groupBy)', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(0)
    })

    it('should subtract refunds from payments correctly', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([
        { type: 'PAYMENT', _sum: { amount: 100000 } },
        { type: 'REFUND', _sum: { amount: 25000 } },
      ])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(75000)
    })

    it('should return negative when refunds exceed payments', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([
        { type: 'PAYMENT', _sum: { amount: 5000 } },
        { type: 'REFUND', _sum: { amount: 12000 } },
      ])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(-7000)
    })

    it('should handle full refund scenario (revenue = 0)', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([
        { type: 'PAYMENT', _sum: { amount: 45000 } },
        { type: 'REFUND', _sum: { amount: 45000 } },
      ])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(0)
    })

    it('should handle payments with no refunds', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([
        { type: 'PAYMENT', _sum: { amount: 80000 } },
      ])

      const revenue = await repo.calculateOrganizerRevenue('org-1')

      expect(revenue).toBe(80000)
    })

    it('should not include ESCROW_RELEASE transactions in revenue', async () => {
      mockPrisma.paymentTransaction.groupBy.mockResolvedValue([])

      await repo.calculateOrganizerRevenue('org-1')

      const call = mockPrisma.paymentTransaction.groupBy.mock.calls[0][0]
      expect(call.where.type).toEqual({ in: ['PAYMENT', 'REFUND'] })
      expect(mockPrisma.paymentTransaction.groupBy).toHaveBeenCalledTimes(1)
    })
  })

  // ── search / buildWhere ──────────────────────────

  describe('search — buildWhere status filter', () => {
    beforeEach(() => {
      mockPrisma.trip.findMany.mockResolvedValue([])
      mockPrisma.trip.count.mockResolvedValue(0)
    })

    it('includes both ACTIVE and FULL in the status filter (C1 fix)', async () => {
      await repo.search({}, { offset: 0, limit: 20 })

      const where = mockPrisma.trip.findMany.mock.calls[0][0].where
      expect(where.status).toEqual({ in: ['ACTIVE', 'FULL'] })
    })

    it('always filters isDeleted=false', async () => {
      await repo.search({}, { offset: 0, limit: 20 })

      const where = mockPrisma.trip.findMany.mock.calls[0][0].where
      expect(where.isDeleted).toBe(false)
    })

    it('forwards destinationId filter when provided', async () => {
      await repo.search({ destinationId: 'dest-1' }, { offset: 0, limit: 20 })

      const where = mockPrisma.trip.findMany.mock.calls[0][0].where
      expect(where.destinationId).toBe('dest-1')
    })

    it('does NOT include destinationId when not provided', async () => {
      await repo.search({}, { offset: 0, limit: 20 })

      const where = mockPrisma.trip.findMany.mock.calls[0][0].where
      expect(where.destinationId).toBeUndefined()
    })

    it('applies correct pagination offset and limit', async () => {
      await repo.search({}, { offset: 20, limit: 10 })

      const call = mockPrisma.trip.findMany.mock.calls[0][0]
      expect(call.skip).toBe(20)
      expect(call.take).toBe(10)
    })

    it('does NOT restrict to ACTIVE only (FULL trips must appear in search)', async () => {
      await repo.search({}, { offset: 0, limit: 20 })

      const where = mockPrisma.trip.findMany.mock.calls[0][0].where
      // Must NOT be a simple string — it must be an IN filter
      expect(typeof where.status).not.toBe('string')
      expect(where.status).toHaveProperty('in')
      expect(where.status.in).toContain('FULL')
    })
  })

  // ── search — buildOrderBy ────────────────────────

  describe('search — buildOrderBy', () => {
    beforeEach(() => {
      mockPrisma.trip.findMany.mockResolvedValue([])
      mockPrisma.trip.count.mockResolvedValue(0)
    })

    it('sorts by createdAt desc for newest', async () => {
      await repo.search({ sort: 'newest' }, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ createdAt: 'desc' })
    })

    it('sorts by currentBookings desc for popularity', async () => {
      await repo.search({ sort: 'popularity' }, { offset: 0, limit: 6 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ currentBookings: 'desc' })
    })

    it('sorts by pricePerPerson asc for price_asc', async () => {
      await repo.search({ sort: 'price_asc' }, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ pricePerPerson: 'asc' })
    })

    it('sorts by pricePerPerson desc for price_desc', async () => {
      await repo.search({ sort: 'price_desc' }, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ pricePerPerson: 'desc' })
    })

    it('sorts by organizer rating desc for rating', async () => {
      await repo.search({ sort: 'rating' }, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ organizer: { rating: 'desc' } })
    })

    it('sorts by startDate asc for date', async () => {
      await repo.search({ sort: 'date' }, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ startDate: 'asc' })
    })

    it('falls back to createdAt desc for unknown sort value', async () => {
      await repo.search({ sort: 'unknown' as any }, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ createdAt: 'desc' })
    })

    it('falls back to createdAt desc when sort is omitted', async () => {
      await repo.search({}, { offset: 0, limit: 20 })
      const orderBy = mockPrisma.trip.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ createdAt: 'desc' })
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
