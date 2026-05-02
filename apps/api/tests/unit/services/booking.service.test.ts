import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingService } from '../../../src/services/booking.service'
import { logger } from '../../../src/utils/logger'

// ── Mock Repository ──────────────────────────────────
const mockBookingRepo = {
  findByUserId: vi.fn(),
  getMyBookingSummary: vi.fn(),
  findById: vi.fn(),
  cancel: vi.fn(),
  findByTripId: vi.fn(),
  getTripBookingSummary: vi.fn(),
}

// ── Test Data Factory ────────────────────────────────
function createMockBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    bookingRef: 'TRP-2025-0001',
    userId: 'user-1',
    bookingStatus: 'CONFIRMED',
    numTravelers: 2,
    totalAmount: 9000,
    tripProtection: false,
    createdAt: new Date('2025-05-01'),
    cancelledAt: null,
    trip: {
      id: 'trip-1',
      title: 'Goa Beach Getaway',
      slug: 'goa-beach-getaway-dec-2025',
      startDate: new Date('2025-12-06'),
      endDate: new Date('2025-12-08'),
      photos: ['photo1.jpg'],
      tripType: 'BEACH',
      cancellationPolicy: 'FLEXIBLE',
      currentBookings: 5,
      version: 0,
      destination: { id: 'dest-1', name: 'Goa', slug: 'goa' },
      organizer: {
        id: 'org-1',
        businessName: 'TripVibes',
        rating: 4.5,
        verificationStatus: 'APPROVED',
      },
    },
    review: null,
    ...overrides,
  }
}

let service: BookingService

beforeEach(() => {
  vi.clearAllMocks()
  service = new BookingService(mockBookingRepo as any, logger as any)
})

describe('BookingService', () => {
  // ═══════════════════════════════════════════════════
  // getMyBookings
  // ═══════════════════════════════════════════════════
  describe('getMyBookings', () => {
    it('should return paginated bookings for the all tab', async () => {
      const mockData = [createMockBooking()]
      mockBookingRepo.findByUserId.mockResolvedValue({ data: mockData, total: 1 })

      const result = await service.getMyBookings('user-1', {})

      expect(result.data).toHaveLength(1)
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 })
      expect(mockBookingRepo.findByUserId).toHaveBeenCalledWith(
        'user-1', undefined, { offset: 0, limit: 10 },
      )
    })

    it('should pass the tab filter to the repository', async () => {
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      await service.getMyBookings('user-1', { tab: 'upcoming' })

      expect(mockBookingRepo.findByUserId).toHaveBeenCalledWith(
        'user-1', 'upcoming', expect.any(Object),
      )
    })

    it('should respect page and limit params', async () => {
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [], total: 25 })

      const result = await service.getMyBookings('user-1', { page: 2, limit: 5 })

      expect(mockBookingRepo.findByUserId).toHaveBeenCalledWith(
        'user-1', undefined, { offset: 5, limit: 5 },
      )
      expect(result.pagination).toEqual({ page: 2, limit: 5, total: 25, totalPages: 5 })
    })

    it('should cap limit to maxLimit (50)', async () => {
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      await service.getMyBookings('user-1', { limit: 100 })

      expect(mockBookingRepo.findByUserId).toHaveBeenCalledWith(
        'user-1', undefined, { offset: 0, limit: 50 },
      )
    })

    it('should map hasReview to true when review exists', async () => {
      const booking = createMockBooking({ review: { id: 'review-1' } })
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [booking], total: 1 })

      const result = await service.getMyBookings('user-1', {})

      expect(result.data[0].hasReview).toBe(true)
    })

    it('should map hasReview to false when review is null', async () => {
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [createMockBooking()], total: 1 })

      const result = await service.getMyBookings('user-1', {})

      expect(result.data[0].hasReview).toBe(false)
    })

    it('should map organizer verified to boolean from verificationStatus', async () => {
      const approved = createMockBooking()
      const pending = createMockBooking({
        trip: { ...createMockBooking().trip, organizer: { ...createMockBooking().trip.organizer, verificationStatus: 'PENDING' } },
      })
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [approved, pending], total: 2 })

      const result = await service.getMyBookings('user-1', {})

      expect(result.data[0].trip.organizer.verified).toBe(true)
      expect(result.data[1].trip.organizer.verified).toBe(false)
    })

    it('should return empty data when no bookings found', async () => {
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getMyBookings('user-1', { tab: 'upcoming' })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════
  // getMyBookingSummary
  // ═══════════════════════════════════════════════════
  describe('getMyBookingSummary', () => {
    it('should return correct counts per tab', async () => {
      mockBookingRepo.getMyBookingSummary.mockResolvedValue([
        { bookingStatus: 'CONFIRMED', _count: { id: 3 } },
        { bookingStatus: 'COMPLETED', _count: { id: 5 } },
        { bookingStatus: 'CANCELLED', _count: { id: 1 } },
        { bookingStatus: 'EXPIRED', _count: { id: 2 } },
        { bookingStatus: 'PENDING_PAYMENT', _count: { id: 1 } },
      ])

      const result = await service.getMyBookingSummary('user-1')

      expect(result).toEqual({
        all: 12,
        upcoming: 4,     // CONFIRMED(3) + PENDING_PAYMENT(1)
        completed: 5,
        cancelled: 3,    // CANCELLED(1) + EXPIRED(2)
      })
    })

    it('should return all zeros when user has no bookings', async () => {
      mockBookingRepo.getMyBookingSummary.mockResolvedValue([])

      const result = await service.getMyBookingSummary('user-1')

      expect(result).toEqual({ all: 0, upcoming: 0, completed: 0, cancelled: 0 })
    })

    it('should merge EXPIRED into cancelled count', async () => {
      mockBookingRepo.getMyBookingSummary.mockResolvedValue([
        { bookingStatus: 'EXPIRED', _count: { id: 4 } },
      ])

      const result = await service.getMyBookingSummary('user-1')

      expect(result.cancelled).toBe(4)
      expect(result.all).toBe(4)
    })

    it('should count REFUNDED in all but not in specific tabs', async () => {
      mockBookingRepo.getMyBookingSummary.mockResolvedValue([
        { bookingStatus: 'REFUNDED', _count: { id: 2 } },
      ])

      const result = await service.getMyBookingSummary('user-1')

      expect(result.all).toBe(2)
      expect(result.upcoming).toBe(0)
      expect(result.completed).toBe(0)
      expect(result.cancelled).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════
  // cancelBooking
  // ═══════════════════════════════════════════════════
  describe('cancelBooking', () => {
    const futureTrip = {
      ...createMockBooking().trip,
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      cancellationPolicy: 'FLEXIBLE',
    }

    beforeEach(() => {
      mockBookingRepo.cancel.mockResolvedValue({})
    })

    it('should cancel with 100% refund for FLEXIBLE >=48h', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.bookingStatus).toBe('CANCELLED')
      expect(result.refundPercent).toBe(100)
      expect(result.refundAmount).toBe(9000)
      expect(mockBookingRepo.cancel).toHaveBeenCalledWith('booking-1', 'user-1', 'Changed plans')
    })

    it('should give 50% refund for FLEXIBLE <48h', async () => {
      const booking = createMockBooking({
        trip: { ...futureTrip, startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.refundPercent).toBe(50)
      expect(result.refundAmount).toBe(4500)
    })

    it('should give 50% refund for MODERATE >=48h', async () => {
      const booking = createMockBooking({
        trip: { ...futureTrip, cancellationPolicy: 'MODERATE' },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.refundPercent).toBe(50)
    })

    it('should give 0% refund for MODERATE <48h', async () => {
      const booking = createMockBooking({
        trip: {
          ...futureTrip,
          cancellationPolicy: 'MODERATE',
          startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.refundPercent).toBe(0)
      expect(result.refundAmount).toBe(0)
    })

    it('should give 0% refund for STRICT always', async () => {
      const booking = createMockBooking({
        trip: { ...futureTrip, cancellationPolicy: 'STRICT' },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.refundPercent).toBe(0)
    })

    it('should throw NotFoundError when booking does not exist', async () => {
      mockBookingRepo.findById.mockResolvedValue(null)

      await expect(
        service.cancelBooking('user-1', 'nonexistent', 'reason'),
      ).rejects.toThrow('not found')
    })

    it('should throw ForbiddenError when user is not the booking owner (IDOR — AR-2)', async () => {
      mockBookingRepo.findById.mockResolvedValue(createMockBooking({ userId: 'other-user' }))

      await expect(
        service.cancelBooking('user-1', 'booking-1', 'reason'),
      ).rejects.toThrow('You can only cancel your own bookings')
    })

    it('should throw ValidationError when booking is already cancelled', async () => {
      mockBookingRepo.findById.mockResolvedValue(createMockBooking({ bookingStatus: 'CANCELLED' }))

      await expect(
        service.cancelBooking('user-1', 'booking-1', 'reason'),
      ).rejects.toThrow()
    })

    it('should throw ValidationError when booking is completed', async () => {
      mockBookingRepo.findById.mockResolvedValue(createMockBooking({ bookingStatus: 'COMPLETED' }))

      await expect(
        service.cancelBooking('user-1', 'booking-1', 'reason'),
      ).rejects.toThrow()
    })
  })
})
