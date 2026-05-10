/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingService } from '../../../src/services/booking.service'
import { logger } from '../../../src/utils/logger'

// ── Mock Repositories ─────────────────────────────────
const mockBookingRepo = {
  findByUserId: vi.fn(),
  getMyBookingSummary: vi.fn(),
  findById: vi.fn(),
  cancel: vi.fn(),
  findByTripId: vi.fn(),
  getTripBookingSummary: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  findActiveByUserAndTrip: vi.fn(),
  findExpiredPendingBookings: vi.fn(),
  findWithPaymentDetails: vi.fn(),
}

const mockTx = {
  booking: { update: vi.fn() },
  $executeRaw: vi.fn(),
}

const mockTripRepo = {
  findById: vi.fn(),
  findByIdForBooking: vi.fn(),
  atomicIncrementBookings: vi.fn(),
  atomicDecrementBookings: vi.fn(),
  markFullIfAtCapacity: vi.fn().mockResolvedValue(0),
  revertFullIfUnderCapacity: vi.fn().mockResolvedValue(0),
  withTransaction: vi.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}

const mockTripRequestRepo = {
  findApprovedForUser: vi.fn(),
  countPendingPaymentForUser: vi.fn().mockResolvedValue(0),
  findPendingPaymentForUser: vi.fn().mockResolvedValue([]),
  markConverted: vi.fn(),
  findActiveByUserAndTrip: vi.fn(),
}

const mockPaymentTxRepo = {
  create: vi.fn(),
  findByBookingId: vi.fn(),
  findByRazorpayOrderId: vi.fn(),
  findByRazorpayPaymentId: vi.fn(),
  updateStatus: vi.fn(),
  updatePaymentId: vi.fn(),
}

const mockPaymentService = {
  createOrder: vi.fn(),
  verifySignature: vi.fn(),
  capturePayment: vi.fn(),
  checkOrderStatus: vi.fn(),
  initiateRefund: vi.fn(),
  resolveBookingIdFromOrder: vi.fn(),
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
    travelerDetails: [
      { id: 'td-1', name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true, emergencyContactName: 'Bob', emergencyContactPhone: '8888888888' },
      { id: 'td-2', name: 'Charlie', phone: '7777777777', age: 30, gender: 'MALE', isPrimary: false, emergencyContactName: null, emergencyContactPhone: null },
    ],
    ...overrides,
  }
}

let service: BookingService

beforeEach(() => {
  vi.clearAllMocks()
  service = new BookingService(
    mockBookingRepo as any,
    mockTripRepo as any,
    mockTripRequestRepo as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
    { send: vi.fn().mockResolvedValue([]) } as any,
  )
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

    it('should include travelerDetails array in response', async () => {
      const booking = createMockBooking()
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [booking], total: 1 })

      const result = await service.getMyBookings('user-1', {})

      expect(result.data[0].travelerDetails).toHaveLength(2)
      expect(result.data[0].travelerDetails[0]).toEqual({
        id: 'td-1',
        name: 'Alice',
        phone: '9999999999',
        age: 25,
        gender: 'FEMALE',
        isPrimary: true,
        emergencyContactName: 'Bob',
        emergencyContactPhone: '8888888888',
      })
    })

    it('should include emergency contact fields in travelerDetails', async () => {
      const booking = createMockBooking()
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [booking], total: 1 })

      const result = await service.getMyBookings('user-1', {})

      const primary = result.data[0].travelerDetails.find((t: { isPrimary: boolean }) => t.isPrimary)
      expect(primary.emergencyContactName).toBe('Bob')
      expect(primary.emergencyContactPhone).toBe('8888888888')
    })

    it('should return empty travelerDetails array when booking has none', async () => {
      const booking = createMockBooking({ travelerDetails: [] })
      mockBookingRepo.findByUserId.mockResolvedValue({ data: [booking], total: 1 })

      const result = await service.getMyBookings('user-1', {})

      expect(result.data[0].travelerDetails).toEqual([])
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
        paymentPending: 0,
      })
    })

    it('should return all zeros when user has no bookings', async () => {
      mockBookingRepo.getMyBookingSummary.mockResolvedValue([])

      const result = await service.getMyBookingSummary('user-1')

      expect(result).toEqual({ all: 0, upcoming: 0, completed: 0, cancelled: 0, paymentPending: 0 })
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

    it('should cancel with 100% refund for FLEXIBLE >=48h (CONFIRMED → tx + decrement)', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.bookingStatus).toBe('CANCELLED')
      expect(result.refundPercent).toBe(100)
      expect(result.refundAmount).toBe(9000)
      // CONFIRMED booking uses transaction, not bookingRepo.cancel
      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
      expect(mockTx.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({ bookingStatus: 'CANCELLED' }),
      }))
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

    it('should decrement seats inside transaction for CONFIRMED bookings', async () => {
      const booking = createMockBooking({ trip: futureTrip, numTravelers: 3 })
      mockBookingRepo.findById.mockResolvedValue(booking)

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockTripRepo.withTransaction).toHaveBeenCalled()
      expect(mockTx.$executeRaw).toHaveBeenCalled()
    })

    it('should revert FULL → ACTIVE after cancellation frees seats', async () => {
      const booking = createMockBooking({ trip: { ...futureTrip, status: 'FULL' } })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockTripRepo.revertFullIfUnderCapacity.mockResolvedValue(1)

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockTripRepo.revertFullIfUnderCapacity).toHaveBeenCalledWith('trip-1')
    })

    it('should skip seat decrement for PENDING_PAYMENT bookings', async () => {
      const booking = createMockBooking({
        bookingStatus: 'PENDING_PAYMENT',
        trip: futureTrip,
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockBookingRepo.cancel).toHaveBeenCalledWith('booking-1', 'user-1', 'Changed plans')
      expect(mockTripRepo.withTransaction).not.toHaveBeenCalled()
      expect(mockTripRepo.revertFullIfUnderCapacity).not.toHaveBeenCalled()
    })

    it('should not touch acceptingBookings during cancel', async () => {
      const booking = createMockBooking({ trip: { ...futureTrip, status: 'FULL' } })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockTripRepo.revertFullIfUnderCapacity.mockResolvedValue(1)

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      // revertFullIfUnderCapacity only updates status — no acceptingBookings change
      // The mock tx should NOT have any update call with acceptingBookings
      if (mockTx.booking.update.mock.calls.length > 0) {
        const updateData = mockTx.booking.update.mock.calls[0][0].data
        expect(updateData).not.toHaveProperty('acceptingBookings')
      }
    })
  })

  // ═══════════════════════════════════════════════════
  // createBooking
  // ═══════════════════════════════════════════════════
  describe('createBooking', () => {
    const validInput = {
      tripId: 'trip-1',
      numTravelers: 2,
      travelers: [
        { name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    }

    const mockTrip = {
      id: 'trip-1',
      title: 'Goa Beach',
      status: 'ACTIVE',
      bookingMode: 'INSTANT',
      acceptingBookings: true,
      pricePerPerson: 5000,
      earlyBirdPrice: 4000,
      earlyBirdDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      bookingDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      maxGroupSize: 20,
      currentBookings: 5,
      version: 0,
      isDeleted: false,
      organizer: {
        id: 'org-1',
        razorpayAccountId: 'acc_org123',
        commissionRate: 10,
        businessName: 'TripVibes',
      },
      transferPoints: [
        { id: 'tp-1', type: 'PICKUP', extraCharge: 500 },
        { id: 'tp-2', type: 'DROP', extraCharge: 200 },
        { id: 'tp-3', type: 'PICKUP', extraCharge: 0 },
      ],
    }

    it('should create booking and Razorpay order for INSTANT trip', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({ id: 'order_abc', amount: 800000 })
      mockBookingRepo.create.mockResolvedValue({
        id: 'booking-new',
        bookingRef: 'TRP-2025-0001',
        totalAmount: 8000,
        expiresAt: new Date(),
      })
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-new' })

      const result = await service.createBooking('user-1', validInput)

      expect(result.bookingId).toBe('booking-new')
      expect(result.razorpayOrderId).toBe('order_abc')
      expect(mockBookingRepo.create).toHaveBeenCalled()
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith({
        bookingId: 'booking-new',
        type: 'PAYMENT',
        amount: 8000,
        razorpayOrderId: 'order_abc',
        status: 'INITIATED',
      })
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      )
    })

    it('should return existing order for idempotent re-request (PENDING_PAYMENT)', async () => {
      const existingBooking = {
        id: 'booking-existing',
        bookingRef: 'TRP-2025-0001',
        bookingStatus: 'PENDING_PAYMENT',
        totalAmount: 8000,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        paymentTransactions: [{ razorpayOrderId: 'order_existing' }],
      }
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(existingBooking)

      const result = await service.createBooking('user-1', validInput)

      expect(result.bookingId).toBe('booking-existing')
      expect(result.razorpayOrderId).toBe('order_existing')
      expect(mockBookingRepo.create).not.toHaveBeenCalled()
    })

    it('should throw ConflictError when user already has CONFIRMED booking', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({
        bookingStatus: 'CONFIRMED',
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('already have a confirmed booking')
    })

    it('should throw NotFoundError when trip does not exist', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(null)

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('Trip')
    })

    it('should throw ValidationError when trip is not ACTIVE', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({ ...mockTrip, status: 'CANCELLED' })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('not accepting bookings')
    })

    it('should throw ValidationError when booking deadline has passed', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        bookingDeadline: new Date(Date.now() - 1000),
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('deadline')
    })

    it('should throw ValidationError when trip is full', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        currentBookings: 20,
        maxGroupSize: 20,
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('seats')
    })

    it('should throw ValidationError when organizer has no razorpayAccountId', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        organizer: { ...mockTrip.organizer, razorpayAccountId: null },
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('payment')
    })

    it('should use early bird price when deadline has not passed', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({ id: 'order_eb', amount: 800000 })
      mockBookingRepo.create.mockResolvedValue({
        id: 'booking-eb',
        bookingRef: 'TRP-2025-0002',
        totalAmount: 8000,
        expiresAt: new Date(),
      })
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-eb' })

      await service.createBooking('user-1', validInput)

      // Early bird: 4000 * 2 = 8000 rupees = 800000 paise
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        800000, expect.any(String), expect.any(Array), expect.any(Object),
      )
    })

    it('should require approved trip request for REQUEST_BASED mode', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({ ...mockTrip, bookingMode: 'REQUEST_BASED' })
      mockTripRequestRepo.findApprovedForUser.mockResolvedValue(null)

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('approved request')
    })

    it('should throw ValidationError when traveler count mismatch', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)

      await expect(
        service.createBooking('user-1', { ...validInput, numTravelers: 3 }),
      ).rejects.toThrow('traveler')
    })
  })

  // ═══════════════════════════════════════════════════
  // confirmBooking
  // ═══════════════════════════════════════════════════
  describe('confirmBooking', () => {
    const mockBookingWithPayment = {
      id: 'booking-1',
      bookingStatus: 'PENDING_PAYMENT',
      numTravelers: 2,
      totalAmount: 8000,
      trip: {
        id: 'trip-1',
        version: 0,
        maxGroupSize: 20,
        currentBookings: 5,
      },
      paymentTransactions: [{
        id: 'ptx-1',
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_abc',
        amount: 8000,
        status: 'AUTHORIZED',
      }],
    }

    it('should capture payment, increment seats, confirm booking, and check FULL', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockBookingRepo.updateStatus.mockResolvedValue({})

      const result = await service.confirmBooking('booking-1')

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockPaymentService.capturePayment).toHaveBeenCalledWith('pay_abc', 800000, 'INR')
      expect(mockTripRepo.atomicIncrementBookings).toHaveBeenCalledWith('trip-1', 2, 0)
      expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith('booking-1', 'CONFIRMED')
      expect(mockTripRepo.markFullIfAtCapacity).toHaveBeenCalledWith('trip-1')
    })

    it('should auto-transition trip to FULL when at capacity', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockBookingRepo.updateStatus.mockResolvedValue({})
      mockTripRepo.markFullIfAtCapacity.mockResolvedValue(1) // 1 row updated = transitioned

      const result = await service.confirmBooking('booking-1')

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockTripRepo.markFullIfAtCapacity).toHaveBeenCalledWith('trip-1')
    })

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(null)

      await expect(
        service.confirmBooking('nonexistent'),
      ).rejects.toThrow('Booking')
    })

    it('should skip and return success if already CONFIRMED (idempotent)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        ...mockBookingWithPayment,
        bookingStatus: 'CONFIRMED',
      })

      const result = await service.confirmBooking('booking-1')

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })

    it('should throw ConflictError when seats are full (increment returns 0)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(0)

      await expect(
        service.confirmBooking('booking-1'),
      ).rejects.toThrow('seats')
    })

    it('should rollback seats when capture fails after seat increment', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockPaymentService.capturePayment.mockRejectedValue(new Error('Capture failed'))
      mockTripRepo.atomicDecrementBookings.mockResolvedValue(1)

      await expect(
        service.confirmBooking('booking-1'),
      ).rejects.toThrow('Capture failed')

      expect(mockTripRepo.atomicDecrementBookings).toHaveBeenCalledWith('trip-1', 2)
    })

    it('should throw ValidationError when no payment transaction exists', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        ...mockBookingWithPayment,
        paymentTransactions: [],
      })

      await expect(
        service.confirmBooking('booking-1'),
      ).rejects.toThrow('payment')
    })
  })

  // ═══════════════════════════════════════════════════
  // verifyAndConfirmPayment
  // ═══════════════════════════════════════════════════
  describe('verifyAndConfirmPayment', () => {
    it('should verify signature and confirm booking', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        bookingStatus: 'PENDING_PAYMENT',
        numTravelers: 2,
        totalAmount: 8000,
        trip: { id: 'trip-1', version: 0 },
        paymentTransactions: [{
          id: 'ptx-1',
          razorpayOrderId: 'order_abc',
          razorpayPaymentId: 'pay_abc',
          amount: 8000,
          status: 'AUTHORIZED',
        }],
      })
      mockPaymentService.verifySignature.mockReturnValue(true)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockBookingRepo.updateStatus.mockResolvedValue({})

      const result = await service.verifyAndConfirmPayment('booking-1', 'user-1', {
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_abc',
        razorpaySignature: 'valid-sig',
      })

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockPaymentService.verifySignature).toHaveBeenCalledWith(
        'order_abc', 'pay_abc', 'valid-sig',
      )
    })

    it('should throw AuthError when signature is invalid', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        bookingStatus: 'PENDING_PAYMENT',
        paymentTransactions: [{ razorpayOrderId: 'order_abc' }],
      })
      mockPaymentService.verifySignature.mockReturnValue(false)

      await expect(
        service.verifyAndConfirmPayment('booking-1', 'user-1', {
          razorpayOrderId: 'order_abc',
          razorpayPaymentId: 'pay_abc',
          razorpaySignature: 'invalid-sig',
        }),
      ).rejects.toThrow('signature')
    })

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(null)

      await expect(
        service.verifyAndConfirmPayment('nonexistent', 'user-1', {
          razorpayOrderId: 'order_abc',
          razorpayPaymentId: 'pay_abc',
          razorpaySignature: 'sig',
        }),
      ).rejects.toThrow('Booking')
    })

    it('should return success if booking already CONFIRMED', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        bookingStatus: 'CONFIRMED',
        paymentTransactions: [{ razorpayOrderId: 'order_abc', status: 'CAPTURED' }],
      })

      const result = await service.verifyAndConfirmPayment('booking-1', 'user-1', {
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_abc',
        razorpaySignature: 'sig',
      })

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(result.paymentStatus).toBe('CAPTURED')
      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })
  })

  describe('createBooking — transfer point validation', () => {
    const validInput = {
      tripId: 'trip-1',
      numTravelers: 2,
      travelers: [
        { name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    }

    const mockTrip = {
      id: 'trip-1',
      title: 'Goa Beach',
      status: 'ACTIVE',
      bookingMode: 'INSTANT',
      acceptingBookings: true,
      pricePerPerson: 5000,
      earlyBirdPrice: null,
      earlyBirdDeadline: null,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      bookingDeadline: null,
      maxGroupSize: 20,
      currentBookings: 5,
      version: 0,
      isDeleted: false,
      organizer: { id: 'org-1', razorpayAccountId: 'acc_org123456789012', commissionRate: 10, businessName: 'TripVibes' },
      transferPoints: [
        { id: 'tp-1', type: 'PICKUP', extraCharge: 500 },
        { id: 'tp-2', type: 'DROP', extraCharge: 200 },
        { id: 'tp-3', type: 'PICKUP', extraCharge: 0 },
      ],
    }

    function setupMocks() {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({ id: 'order_tp', amount: 1000000 })
      mockBookingRepo.create.mockResolvedValue({ id: 'booking-tp', bookingRef: 'TRP-TP-0001', totalAmount: 10000, expiresAt: new Date() })
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-tp' })
    }

    it('should throw ValidationError when pickupPointId does not belong to trip', async () => {
      setupMocks()

      await expect(
        service.createBooking('user-1', { ...validInput, pickupPointId: 'non-existent-id' }),
      ).rejects.toThrow('pickup point does not belong')
    })

    it('should throw ValidationError when pickupPointId type is not PICKUP', async () => {
      setupMocks()

      await expect(
        service.createBooking('user-1', { ...validInput, pickupPointId: 'tp-2' }),
      ).rejects.toThrow('not a PICKUP type')
    })

    it('should throw ValidationError when dropPointId type is not DROP', async () => {
      setupMocks()

      await expect(
        service.createBooking('user-1', { ...validInput, dropPointId: 'tp-1' }),
      ).rejects.toThrow('not a DROP type')
    })

    it('should add pickup and drop extraCharge to totalAmount', async () => {
      setupMocks()

      await service.createBooking('user-1', { ...validInput, pickupPointId: 'tp-1', dropPointId: 'tp-2' })

      // base 5000 + pickup 500 + drop 200 = 5700 per person × 2 = 11400 rupees = 1140000 paise
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        1140000,
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      )
    })

    it('should set totalAmount correctly when extraCharge is 0', async () => {
      setupMocks()

      await service.createBooking('user-1', { ...validInput, pickupPointId: 'tp-3' })

      // base 5000 + pickup 0 = 5000 per person × 2 = 10000 rupees = 1000000 paise
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        1000000,
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // getMyTripStatus
  // ═══════════════════════════════════════════════════
  describe('getMyTripStatus', () => {
    it('should return CONFIRMED booking status when user has confirmed booking', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({ bookingStatus: 'CONFIRMED' })
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue(null)

      const result = await service.getMyTripStatus('user-1', 'trip-1')

      expect(result).toEqual({ bookingStatus: 'CONFIRMED', requestStatus: null })
      expect(mockBookingRepo.findActiveByUserAndTrip).toHaveBeenCalledWith('user-1', 'trip-1')
      expect(mockTripRequestRepo.findActiveByUserAndTrip).toHaveBeenCalledWith('trip-1', 'user-1')
    })

    it('should return PENDING_PAYMENT booking status when payment is pending', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({ bookingStatus: 'PENDING_PAYMENT' })
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue(null)

      const result = await service.getMyTripStatus('user-1', 'trip-1')

      expect(result).toEqual({ bookingStatus: 'PENDING_PAYMENT', requestStatus: null })
    })

    it('should return PENDING request status when user has pending request', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue({ id: 'req-1', status: 'PENDING' })

      const result = await service.getMyTripStatus('user-1', 'trip-1')

      expect(result).toEqual({ bookingStatus: null, requestStatus: 'PENDING' })
    })

    it('should return APPROVED request status when user has approved request', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue({ id: 'req-1', status: 'APPROVED' })

      const result = await service.getMyTripStatus('user-1', 'trip-1')

      expect(result).toEqual({ bookingStatus: null, requestStatus: 'APPROVED' })
    })

    it('should return both statuses when user has booking and request', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({ bookingStatus: 'PENDING_PAYMENT' })
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue({ id: 'req-1', status: 'APPROVED' })

      const result = await service.getMyTripStatus('user-1', 'trip-1')

      expect(result).toEqual({ bookingStatus: 'PENDING_PAYMENT', requestStatus: 'APPROVED' })
    })

    it('should return both null when user has no active booking or request', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue(null)

      const result = await service.getMyTripStatus('user-1', 'trip-1')

      expect(result).toEqual({ bookingStatus: null, requestStatus: null })
    })

    it('should call both repos concurrently via Promise.all', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue(null)

      await service.getMyTripStatus('user-1', 'trip-1')

      expect(mockBookingRepo.findActiveByUserAndTrip).toHaveBeenCalledTimes(1)
      expect(mockTripRequestRepo.findActiveByUserAndTrip).toHaveBeenCalledTimes(1)
    })

    it('should propagate error when bookingRepo throws', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockRejectedValue(new Error('DB connection lost'))
      mockTripRequestRepo.findActiveByUserAndTrip.mockResolvedValue(null)

      await expect(
        service.getMyTripStatus('user-1', 'trip-1'),
      ).rejects.toThrow('DB connection lost')
    })

    it('should propagate error when tripRequestRepo throws', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRequestRepo.findActiveByUserAndTrip.mockRejectedValue(new Error('Query timeout'))

      await expect(
        service.getMyTripStatus('user-1', 'trip-1'),
      ).rejects.toThrow('Query timeout')
    })
  })
})
