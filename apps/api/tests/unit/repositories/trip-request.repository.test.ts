/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TripRequestRepository } from '../../../src/repositories/trip-request.repository'

// ── Mock Prisma client ───────────────────────────────

function createMockPrisma() {
  return {
    tripRequest: {
      findFirst: vi.fn(),
    },
  }
}

// ── Tests ────────────────────────────────────────────

describe('TripRequestRepository', () => {
  let repo: TripRequestRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new TripRequestRepository(mockPrisma as any)
  })

  // ── findActiveByUserAndTrip ────────────────────

  describe('findActiveByUserAndTrip', () => {
    it('should query with correct WHERE clause (PENDING or non-expired APPROVED)', async () => {
      mockPrisma.tripRequest.findFirst.mockResolvedValue(null)

      await repo.findActiveByUserAndTrip('trip-1', 'user-1')

      const call = mockPrisma.tripRequest.findFirst.mock.calls[0][0]
      expect(call.where).toEqual({
        tripId: 'trip-1',
        userId: 'user-1',
        isDeleted: false,
        OR: [
          { status: 'PENDING' },
          { status: 'APPROVED', approvalExpiresAt: { gt: expect.any(Date) } },
        ],
      })
    })

    it('should select only id and status fields', async () => {
      mockPrisma.tripRequest.findFirst.mockResolvedValue(null)

      await repo.findActiveByUserAndTrip('trip-1', 'user-1')

      const call = mockPrisma.tripRequest.findFirst.mock.calls[0][0]
      expect(call.select).toEqual({ id: true, status: true })
    })

    it('should return the trip request when found', async () => {
      const mockRequest = { id: 'req-1', status: 'PENDING' }
      mockPrisma.tripRequest.findFirst.mockResolvedValue(mockRequest)

      const result = await repo.findActiveByUserAndTrip('trip-1', 'user-1')

      expect(result).toEqual(mockRequest)
    })

    it('should return null when no active request exists', async () => {
      mockPrisma.tripRequest.findFirst.mockResolvedValue(null)

      const result = await repo.findActiveByUserAndTrip('trip-1', 'user-1')

      expect(result).toBeNull()
    })

    it('should use the approvalExpiresAt gt filter with a Date close to now', async () => {
      mockPrisma.tripRequest.findFirst.mockResolvedValue(null)
      const before = new Date()

      await repo.findActiveByUserAndTrip('trip-1', 'user-1')

      const call = mockPrisma.tripRequest.findFirst.mock.calls[0][0]
      const approvedCondition = call.where.OR[1]
      const filterDate = approvedCondition.approvalExpiresAt.gt as Date
      const after = new Date()

      // The Date used in the query should be between before and after (i.e., "now")
      expect(filterDate.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(filterDate.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })
})
