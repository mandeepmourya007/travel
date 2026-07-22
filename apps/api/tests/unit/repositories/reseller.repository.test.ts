/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResellerRepository } from '../../../src/repositories/reseller.repository'

// ── Mock Prisma client ───────────────────────────────
function createMockPrisma() {
  return {
    sublinkAttribution: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    resellerMainLink: {
      findFirst: vi.fn(),
    },
    resellerSublink: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    booking: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  }
}

describe('ResellerRepository', () => {
  let repo: ResellerRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new ResellerRepository(mockPrisma as any)
  })

  // ═══════════════════════════════════════════════════
  // upsertAttribution — last-wins
  // ═══════════════════════════════════════════════════
  describe('upsertAttribution', () => {
    it('upserts on the (userId, tripId) composite key with create+update both pointing at the new sublink', async () => {
      mockPrisma.sublinkAttribution.upsert.mockResolvedValue({ userId: 'user-1', sublinkId: 'sub-A', tripId: 'trip-1' })

      await repo.upsertAttribution('user-1', 'sub-A', 'trip-1')

      expect(mockPrisma.sublinkAttribution.upsert).toHaveBeenCalledWith({
        where: { userId_tripId: { userId: 'user-1', tripId: 'trip-1' } },
        create: { userId: 'user-1', sublinkId: 'sub-A', tripId: 'trip-1' },
        update: { sublinkId: 'sub-A' },
      })
    })

    it('last-wins: a second call for the same (userId, tripId) with a different sublinkId overwrites — update payload reflects only the new sublink', async () => {
      mockPrisma.sublinkAttribution.upsert.mockResolvedValueOnce({ userId: 'user-1', sublinkId: 'sub-A', tripId: 'trip-1' })
      mockPrisma.sublinkAttribution.upsert.mockResolvedValueOnce({ userId: 'user-1', sublinkId: 'sub-B', tripId: 'trip-1' })

      await repo.upsertAttribution('user-1', 'sub-A', 'trip-1')
      await repo.upsertAttribution('user-1', 'sub-B', 'trip-1')

      expect(mockPrisma.sublinkAttribution.upsert).toHaveBeenCalledTimes(2)
      // Same where-key both times (same user+trip) — only the update/create sublinkId differs.
      const [firstCall, secondCall] = mockPrisma.sublinkAttribution.upsert.mock.calls
      expect(firstCall[0].where).toEqual(secondCall[0].where)
      expect(firstCall[0].update.sublinkId).toBe('sub-A')
      expect(secondCall[0].update.sublinkId).toBe('sub-B')
    })
  })

  // ═══════════════════════════════════════════════════
  // findActiveByToken — dispatch to main/sublink lookup
  // ═══════════════════════════════════════════════════
  describe('findActiveByToken', () => {
    it("dispatches to the main-link lookup (active, not-deleted) when kind='main'", async () => {
      mockPrisma.resellerMainLink.findFirst.mockResolvedValue({ id: 'link-1', token: 'tok' })

      const result = await repo.findActiveByToken('tok', 'main')

      expect(mockPrisma.resellerMainLink.findFirst).toHaveBeenCalledWith({
        where: { token: 'tok', isActive: true, isDeleted: false },
      })
      expect(mockPrisma.resellerSublink.findFirst).not.toHaveBeenCalled()
      expect(result).toEqual({ id: 'link-1', token: 'tok' })
    })

    it("dispatches to the sublink lookup (active, not-deleted, with trip+reseller joins) when kind='sublink'", async () => {
      mockPrisma.resellerSublink.findFirst.mockResolvedValue({ id: 'sub-1', token: 'tok2' })

      const result = await repo.findActiveByToken('tok2', 'sublink')

      expect(mockPrisma.resellerSublink.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: 'tok2', isActive: true, isDeleted: false } }),
      )
      expect(mockPrisma.resellerMainLink.findFirst).not.toHaveBeenCalled()
      expect(result).toEqual({ id: 'sub-1', token: 'tok2' })
    })
  })

  // ═══════════════════════════════════════════════════
  // findAttributionByUserAndTrip
  // ═══════════════════════════════════════════════════
  describe('findAttributionByUserAndTrip', () => {
    it('looks up by the composite (userId, tripId) unique key and includes the sublink for gating fields', async () => {
      mockPrisma.sublinkAttribution.findUnique.mockResolvedValue({
        userId: 'user-1', tripId: 'trip-1', sublink: { id: 'sub-1', markupAmount: 300, tripId: 'trip-1', isActive: true, isDeleted: false },
      })

      const result = await repo.findAttributionByUserAndTrip('user-1', 'trip-1')

      expect(mockPrisma.sublinkAttribution.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId_tripId: { userId: 'user-1', tripId: 'trip-1' } } }),
      )
      expect(result?.sublink.markupAmount).toBe(300)
    })

    it('returns null when there is no attribution for this user+trip', async () => {
      mockPrisma.sublinkAttribution.findUnique.mockResolvedValue(null)

      const result = await repo.findAttributionByUserAndTrip('user-1', 'trip-1')

      expect(result).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════
  // getLeads — mainLinkId scoping (admin "sublinks for this main link" modal)
  // ═══════════════════════════════════════════════════
  describe('getLeads', () => {
    it('scopes the where-clause to a single mainLinkId when provided, alongside the existing tripId/resellerId/organizerId filters', async () => {
      mockPrisma.resellerSublink.findMany.mockResolvedValue([
        {
          id: 'sub-1', token: 'tok-1', label: null, mainLinkId: 'main-A', tripId: 'trip-1',
          resellerId: 'reseller-1', isActive: true, createdAt: new Date('2024-01-01'), markupAmount: 100,
          trip: { title: 'Trip One' }, reseller: { name: 'Reseller One' },
          mainLink: { organizerId: 'org-1', resellerEmail: 'r1@example.com', organizer: { businessName: 'Org One' } },
        },
      ])
      mockPrisma.resellerSublink.count.mockResolvedValue(1)
      mockPrisma.booking.groupBy.mockResolvedValue([])

      await repo.getLeads({ mainLinkId: 'main-A', sort: 'newest' }, { skip: 0, take: 10 })

      expect(mockPrisma.resellerSublink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ mainLinkId: 'main-A' }),
        }),
      )
      expect(mockPrisma.resellerSublink.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ mainLinkId: 'main-A' }) }),
      )
    })

    it('omits mainLinkId from the where-clause when not provided, so other main links are not excluded', async () => {
      mockPrisma.resellerSublink.findMany.mockResolvedValue([])
      mockPrisma.resellerSublink.count.mockResolvedValue(0)
      mockPrisma.booking.groupBy.mockResolvedValue([])

      await repo.getLeads({ sort: 'newest' }, { skip: 0, take: 10 })

      const call = mockPrisma.resellerSublink.findMany.mock.calls[0][0]
      expect(call.where).not.toHaveProperty('mainLinkId')
    })

    // ─────────────────────────────────────────────────
    // Bug repro: only CONFIRMED/COMPLETED bookings represent earned markup —
    // PENDING_PAYMENT/CANCELLED/EXPIRED bookings must not inflate
    // bookingCount/totalMarkupAmount (see live E2E repro on sublink
    // 019f77a9-bb51-7382-8897-88ae7dfcc170 — 3 bookings, only 2 confirmed,
    // endpoint wrongly returned bookingCount:3/totalMarkupAmount:3600).
    // ─────────────────────────────────────────────────
    const FAKE_SUBLINK_ROW = {
      id: 'sub-1', token: 'tok-1', label: null, mainLinkId: 'main-A', tripId: 'trip-1',
      resellerId: 'reseller-1', isActive: true, createdAt: new Date('2024-01-01'), markupAmount: 600,
      trip: { title: 'Trip One' }, reseller: { name: 'Reseller One' },
      mainLink: { organizerId: 'org-1', resellerEmail: 'r1@example.com', organizer: { businessName: 'Org One' } },
    }

    /** Simulates Postgres-side filtering by bookingStatus for booking.groupBy, given a fixed set of fake bookings. */
    function mockGroupByFilteringByStatus(fakeBookings: { sublinkId: string; bookingStatus: string; markupAmount: number; numTravelers: number }[]) {
      mockPrisma.booking.groupBy.mockImplementation(async (args: any) => {
        const allowedStatuses: string[] | undefined = args.where?.bookingStatus?.in
        const filtered = fakeBookings.filter((b) => !allowedStatuses || allowedStatuses.includes(b.bookingStatus))
        const bySublinkId = new Map<string, { count: number; markupSum: number; travelersSum: number }>()
        for (const b of filtered) {
          const cur = bySublinkId.get(b.sublinkId) ?? { count: 0, markupSum: 0, travelersSum: 0 }
          bySublinkId.set(b.sublinkId, {
            count: cur.count + 1,
            markupSum: cur.markupSum + b.markupAmount,
            travelersSum: cur.travelersSum + b.numTravelers,
          })
        }
        return Array.from(bySublinkId.entries()).map(([sublinkId, agg]) => ({
          sublinkId,
          _count: { id: agg.count },
          _sum: { markupAmount: agg.markupSum, numTravelers: agg.travelersSum },
        }))
      })
    }

    it('excludes a PENDING_PAYMENT booking from bookingCount/totalMarkupAmount — counts only the confirmed ones', async () => {
      mockPrisma.resellerSublink.findMany.mockResolvedValue([FAKE_SUBLINK_ROW])
      mockPrisma.resellerSublink.count.mockResolvedValue(1)
      mockGroupByFilteringByStatus([
        { sublinkId: 'sub-1', bookingStatus: 'CONFIRMED', markupAmount: 600, numTravelers: 1 },
        { sublinkId: 'sub-1', bookingStatus: 'CONFIRMED', markupAmount: 1200, numTravelers: 2 },
        { sublinkId: 'sub-1', bookingStatus: 'PENDING_PAYMENT', markupAmount: 1800, numTravelers: 3 },
      ])

      const result = await repo.getLeads({ sort: 'newest' }, { skip: 0, take: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].bookingCount).toBe(2)
      expect(result.data[0].totalMarkupAmount).toBe(1800)
      expect(result.data[0].totalTravelers).toBe(3)
      // The where clause passed to groupBy must actually carry the status filter.
      const groupByCall = mockPrisma.booking.groupBy.mock.calls[0][0]
      expect(groupByCall.where.bookingStatus).toEqual({ in: ['CONFIRMED', 'COMPLETED'] })
    })

    it('excludes a CANCELLED booking from bookingCount/totalMarkupAmount as well', async () => {
      mockPrisma.resellerSublink.findMany.mockResolvedValue([FAKE_SUBLINK_ROW])
      mockPrisma.resellerSublink.count.mockResolvedValue(1)
      mockGroupByFilteringByStatus([
        { sublinkId: 'sub-1', bookingStatus: 'CONFIRMED', markupAmount: 600, numTravelers: 1 },
        { sublinkId: 'sub-1', bookingStatus: 'CANCELLED', markupAmount: 1200, numTravelers: 2 },
      ])

      const result = await repo.getLeads({ sort: 'newest' }, { skip: 0, take: 10 })

      expect(result.data[0].bookingCount).toBe(1)
      expect(result.data[0].totalMarkupAmount).toBe(600)
    })
  })

  // ═══════════════════════════════════════════════════
  // listBookingsForMainLink — refundStatus derivation
  // ═══════════════════════════════════════════════════
  describe('listBookingsForMainLink', () => {
    const baseRow = {
      id: 'booking-1',
      bookingRef: 'BK-1',
      numTravelers: 2,
      totalAmount: 5000,
      markupAmount: 500,
      createdAt: new Date('2026-01-01'),
      user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    }

    it("maps a REFUNDED booking to refundStatus: 'REFUNDED'", async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { ...baseRow, bookingStatus: 'REFUNDED', paymentTransactions: [{ status: 'REFUNDED' }] },
      ])
      mockPrisma.booking.count.mockResolvedValue(1)

      const result = await repo.listBookingsForMainLink('main-1', { skip: 0, take: 10 })

      expect(result.data[0].refundStatus).toBe('REFUNDED')
      expect(result.data[0]).not.toHaveProperty('paymentTransactions')
    })

    it("maps a CANCELLED booking with a pending REFUND transaction to refundStatus: 'PENDING'", async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { ...baseRow, bookingStatus: 'CANCELLED', paymentTransactions: [{ status: 'INITIATED' }] },
      ])
      mockPrisma.booking.count.mockResolvedValue(1)

      const result = await repo.listBookingsForMainLink('main-1', { skip: 0, take: 10 })

      expect(result.data[0].refundStatus).toBe('PENDING')
    })

    it('maps a CANCELLED booking with no REFUND transaction to refundStatus: null (nothing was owed)', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { ...baseRow, bookingStatus: 'CANCELLED', paymentTransactions: [] },
      ])
      mockPrisma.booking.count.mockResolvedValue(1)

      const result = await repo.listBookingsForMainLink('main-1', { skip: 0, take: 10 })

      expect(result.data[0].refundStatus).toBeNull()
    })

    it('leaves refundStatus: null for unrelated statuses like CONFIRMED', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { ...baseRow, bookingStatus: 'CONFIRMED', paymentTransactions: [] },
      ])
      mockPrisma.booking.count.mockResolvedValue(1)

      const result = await repo.listBookingsForMainLink('main-1', { skip: 0, take: 10 })

      expect(result.data[0].refundStatus).toBeNull()
      expect(result.data[0].bookingStatus).toBe('CONFIRMED')
    })
  })
})
