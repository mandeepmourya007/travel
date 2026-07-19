/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BookingService } from '../../../src/services/booking.service'
import { logger } from '../../../src/utils/logger'
import { withLock } from '../../../src/utils/redis-lock'

// Default: withLock executes fn immediately and returns true (lock acquired).
// Individual tests override this per-case.
vi.mock('../../../src/utils/redis-lock', () => ({
  withLock: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<void>) => {
    await fn()
    return true
  }),
}))

const mockEnv = {
  PAYMENT_GATEWAY: 'razorpay' as 'razorpay' | 'cashfree',
  CASHFREE_ENV: 'sandbox' as 'sandbox' | 'production',
  CLIENT_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
}

vi.mock('../../../src/config/env', () => ({
  get env() { return mockEnv },
}))

// ── Mock Repositories ─────────────────────────────────
const mockBookingRepo = {
  findByUserId: vi.fn(),
  getMyBookingSummary: vi.fn(),
  findById: vi.fn(),
  cancelAtomically: vi.fn(),
  atomicConfirmGate: vi.fn(),
  revertConfirmGate: vi.fn(),
  findByTripId: vi.fn(),
  getTripBookingSummary: vi.fn(),
  create: vi.fn(),
  createWithPaymentTx: vi.fn(),
  withTransaction: vi.fn(),
  updateStatus: vi.fn(),
  findActiveByUserAndTrip: vi.fn(),
  findExpiredPendingBookings: vi.fn(),
  findWithPaymentDetails: vi.fn(),
}

const mockTripRepo = {
  findById: vi.fn(),
  findByIdForBooking: vi.fn(),
  atomicIncrementBookings: vi.fn(),
  atomicDecrementBookings: vi.fn(),
  markFullIfAtCapacity: vi.fn().mockResolvedValue(0),
  revertFullIfUnderCapacity: vi.fn().mockResolvedValue(0),
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
  findByGatewayOrderId: vi.fn(),
  findByGatewayPaymentId: vi.fn(),
  findByRazorpayOrderId: vi.fn(),
  findByRazorpayPaymentId: vi.fn(),
  updateStatus: vi.fn(),
  updatePaymentId: vi.fn(),
  recordRetryAttempt: vi.fn(),
}

const mockPaymentService = {
  createOrder: vi.fn(),
  verifySignature: vi.fn(),      // keep for backward compat — not called by new code
  verifyClientCallback: vi.fn(),
  capturePayment: vi.fn(),
  checkOrderStatus: vi.fn(),
  initiateRefund: vi.fn(),
  resolveBookingIdFromOrder: vi.fn(),
  fetchPaymentIdForOrder: vi.fn(),
  resolveProviderFromTx: vi.fn().mockReturnValue('razorpay'),
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
      { id: 'td-1', name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true, emergencyContactName: 'Bob', emergencyContactPhone: '8888888888', assignedSeat: null },
      { id: 'td-2', name: 'Charlie', phone: '7777777777', age: 30, gender: 'MALE', isPrimary: false, emergencyContactName: null, emergencyContactPhone: null, assignedSeat: null },
    ],
    ...overrides,
  }
}

let service: BookingService

afterEach(() => {
  mockEnv.PAYMENT_GATEWAY = 'razorpay'
})

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
        assignedSeat: null,
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
      // Default: gate wins for a CONFIRMED booking
      mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 1, preCancelStatus: 'CONFIRMED' })
      // initiateBookingRefund reads payment txs — default to no captured tx (skips gateway call)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([])
      // Default provider resolution: Razorpay (most tests use Razorpay txs)
      mockPaymentService.resolveProviderFromTx.mockReturnValue('razorpay')
    })

    it('should cancel with 100% refund for FLEXIBLE >=48h (CONFIRMED)', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.bookingStatus).toBe('CANCELLED')
      expect(result.refundPercent).toBe(100)
      expect(result.refundAmount).toBe(9000)
      expect(mockBookingRepo.cancelAtomically).toHaveBeenCalledWith(
        'booking-1', 'user-1', 'Changed plans',
        { tripId: 'trip-1', numTravelers: 2 },
      )
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

    it('should throw ForbiddenError when user is not the booking owner (IDOR)', async () => {
      mockBookingRepo.findById.mockResolvedValue(createMockBooking({ userId: 'other-user' }))

      await expect(
        service.cancelBooking('user-1', 'booking-1', 'reason'),
      ).rejects.toThrow('You can only cancel your own bookings')
    })

    it('should throw ValidationError when gate returns 0 (booking already terminal)', async () => {
      mockBookingRepo.findById.mockResolvedValue(createMockBooking({ bookingStatus: 'CONFIRMED' }))
      mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 0, preCancelStatus: 'CANCELLED' })

      await expect(
        service.cancelBooking('user-1', 'booking-1', 'reason'),
      ).rejects.toThrow()
    })

    it('should revert FULL → ACTIVE after CONFIRMED cancellation frees seats', async () => {
      const booking = createMockBooking({ trip: { ...futureTrip, status: 'FULL' } })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockTripRepo.revertFullIfUnderCapacity.mockResolvedValue(1)

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockTripRepo.revertFullIfUnderCapacity).toHaveBeenCalledWith('trip-1')
    })

    it('should skip seat revert for PENDING_PAYMENT cancel (preCancelStatus = PENDING_PAYMENT)', async () => {
      const booking = createMockBooking({ bookingStatus: 'PENDING_PAYMENT', trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 1, preCancelStatus: 'PENDING_PAYMENT' })

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      // Seat decrement handled inside cancelAtomically (seatArgs passed); revert only fires for CONFIRMED
      expect(mockTripRepo.revertFullIfUnderCapacity).not.toHaveBeenCalled()
    })

    it('should pass seatArgs to cancelAtomically regardless of stale booking status', async () => {
      // Service must pass seatArgs always — cancelAtomically uses the DB-authoritative status
      const booking = createMockBooking({ bookingStatus: 'PENDING_PAYMENT', trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 1, preCancelStatus: 'PENDING_PAYMENT' })

      await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(mockBookingRepo.cancelAtomically).toHaveBeenCalledWith(
        'booking-1', 'user-1', 'reason',
        { tripId: 'trip-1', numTravelers: 2 },
      )
    })

    // ── Refund amount unit conversion ───────────────────────────────────────

    it('should store REFUND tx in rupees and call Razorpay in paise (100% refund)', async () => {
      const booking = createMockBooking({ trip: futureTrip }) // FLEXIBLE >=48h → 100%, totalAmount=9000
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap-1', type: 'PAYMENT', status: 'CAPTURED', gatewayPaymentId: 'pay_abc123', razorpayPaymentId: 'pay_abc123' },
      ])
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund-1' })
      mockPaymentService.initiateRefund.mockResolvedValue({ id: 'rfnd_x', status: 'processed' })

      const result = await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(result.refundAmount).toBe(9000)
      // REFUND tx stored in rupees — never paise
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'REFUND',
        amount: 9000,
        status: 'INITIATED',
      }))
      // Razorpay API receives amount in paise
      expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
        'pay_abc123',
        900000, // 9000 rupees × 100
        expect.objectContaining({ bookingId: 'booking-1' }),
        'razorpay',
      )
    })

    it('should store REFUND tx in rupees and call Razorpay in paise (50% partial refund)', async () => {
      const booking = createMockBooking({
        totalAmount: 8000,
        trip: { ...futureTrip, startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) }, // <48h → 50%
      })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap-2', type: 'PAYMENT', status: 'CAPTURED', gatewayPaymentId: 'pay_def456', razorpayPaymentId: 'pay_def456' },
      ])
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund-2' })
      mockPaymentService.initiateRefund.mockResolvedValue({ id: 'rfnd_y', status: 'processed' })

      const result = await service.cancelBooking('user-1', 'booking-1', 'Emergency')

      expect(result.refundPercent).toBe(50)
      expect(result.refundAmount).toBe(4000) // Math.round(8000 * 50 / 100)
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 4000, // rupees, not paise
        status: 'INITIATED',
      }))
      expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
        'pay_def456',
        400000, // 4000 rupees × 100
        expect.any(Object),
        'razorpay',
      )
    })

    it('should NOT create REFUND tx or call initiateRefund when STRICT policy (0% refund)', async () => {
      const booking = createMockBooking({
        trip: { ...futureTrip, cancellationPolicy: 'STRICT' },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap-3', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_strict' },
      ])

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.refundAmount).toBe(0)
      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).not.toHaveBeenCalled()
    })

    it('should NOT call initiateRefund when preCancelStatus is PENDING_PAYMENT (no captured payment)', async () => {
      const booking = createMockBooking({ bookingStatus: 'PENDING_PAYMENT', trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 1, preCancelStatus: 'PENDING_PAYMENT' })
      // Even if a CAPTURED tx somehow exists, refund must NOT fire for non-CONFIRMED cancels
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap-4', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_pp' },
      ])

      await service.cancelBooking('user-1', 'booking-1', 'reason')

      // wasConfirmed = false → initiateBookingRefund never entered at all
      expect(mockPaymentTxRepo.findByBookingId).not.toHaveBeenCalled()
      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).not.toHaveBeenCalled()
    })

    it('should swallow Razorpay error and leave REFUND tx INITIATED for ops retry', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap-5', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_err' },
      ])
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund-err' })
      mockPaymentService.initiateRefund.mockRejectedValue(new Error('Razorpay gateway timeout'))

      // Cancellation is committed — the Razorpay failure must NOT propagate
      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.bookingStatus).toBe('CANCELLED')
      expect(result.refundAmount).toBe(9000)
      // REFUND tx was created (INITIATED) before the Razorpay call — remains as retry target
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'REFUND',
        status: 'INITIATED',
      }))
      expect(mockPaymentService.initiateRefund).toHaveBeenCalled()
    })

    it('should skip Razorpay call when no CAPTURED payment tx exists (only AUTHORIZED tx)', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-auth', type: 'PAYMENT', status: 'AUTHORIZED', razorpayPaymentId: 'pay_auth' },
      ])

      await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).not.toHaveBeenCalled()
    })

    it('should skip Razorpay call when PAYMENT tx has no razorpayPaymentId', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap-6', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: null },
      ])

      await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).not.toHaveBeenCalled()
    })

    // ── Math.round edge cases ───────────────────────────────────────────────

    it('should Math.round refund amount for odd totalAmount (50% of 9001 = 4501)', async () => {
      const booking = createMockBooking({
        totalAmount: 9001,
        trip: { ...futureTrip, startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) }, // <48h → 50%
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      // Math.round(9001 * 50 / 100) = Math.round(4500.5) = 4501
      expect(result.refundAmount).toBe(4501)
      expect(result.refundPercent).toBe(50)
    })

    it('should Math.round refund amount for odd totalAmount (50% of 8999 = 4500)', async () => {
      const booking = createMockBooking({
        totalAmount: 8999,
        trip: { ...futureTrip, startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) }, // <48h → 50%
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      // Math.round(8999 * 50 / 100) = Math.round(4499.5) = 4500
      expect(result.refundAmount).toBe(4500)
    })

    // ── 48-hour boundary ────────────────────────────────────────────────────

    it('should give 100% refund for FLEXIBLE at >=48h boundary', async () => {
      const booking = createMockBooking({
        trip: {
          ...futureTrip,
          cancellationPolicy: 'FLEXIBLE',
          startDate: new Date(Date.now() + 48 * 60 * 60 * 1000 + 5000), // 48h + 5s buffer
        },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.refundPercent).toBe(100)
    })

    it('should give 50% refund for FLEXIBLE just under 48h boundary', async () => {
      const booking = createMockBooking({
        trip: {
          ...futureTrip,
          cancellationPolicy: 'FLEXIBLE',
          startDate: new Date(Date.now() + 48 * 60 * 60 * 1000 - 1), // 1ms under 48h
        },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.refundPercent).toBe(50)
    })

    it('should give 50% refund for MODERATE at >=48h boundary', async () => {
      const booking = createMockBooking({
        trip: {
          ...futureTrip,
          cancellationPolicy: 'MODERATE',
          startDate: new Date(Date.now() + 48 * 60 * 60 * 1000 + 5000),
        },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.refundPercent).toBe(50)
    })

    it('should give 0% refund for MODERATE just under 48h boundary', async () => {
      const booking = createMockBooking({
        trip: {
          ...futureTrip,
          cancellationPolicy: 'MODERATE',
          startDate: new Date(Date.now() + 48 * 60 * 60 * 1000 - 1),
        },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.refundPercent).toBe(0)
    })

    it('should give 0% refund for unknown/null cancellation policy (defensive default)', async () => {
      const booking = createMockBooking({
        trip: { ...futureTrip, cancellationPolicy: 'UNKNOWN_POLICY' },
      })
      mockBookingRepo.findById.mockResolvedValue(booking)

      const result = await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(result.refundPercent).toBe(0)
      expect(result.refundAmount).toBe(0)
    })

    // ── Double-refund guard ─────────────────────────────────────────────────

    it('should skip Razorpay refund call when REFUND tx already REFUNDED (idempotent retry)', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_abc' },
        { id: 'ptx-ref', type: 'REFUND', status: 'REFUNDED', razorpayRefundId: 'rfnd_done', amount: 9000, metadata: { reason: 'Changed plans' } },
      ])

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      // Already REFUNDED — must not create another REFUND tx or call Razorpay again
      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).not.toHaveBeenCalled()
    })

    it('should skip Razorpay refund call when REFUND tx has razorpayRefundId (Razorpay already processed)', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_abc' },
        // INITIATED but already has a Razorpay refund ID — crash-recovery case; webhook will close it
        { id: 'ptx-ref', type: 'REFUND', status: 'INITIATED', razorpayRefundId: 'rfnd_pending', amount: 9000, metadata: {} },
      ])

      await service.cancelBooking('user-1', 'booking-1', 'reason')

      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).not.toHaveBeenCalled()
    })

    it('should retry Razorpay refund using stored amount when existing REFUND tx is INITIATED with no refund ID', async () => {
      const booking = createMockBooking({ trip: futureTrip }) // totalAmount=9000
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_abc' },
        // Prior attempt created the INITIATED tx but crashed before Razorpay responded
        { id: 'ptx-ref', type: 'REFUND', status: 'INITIATED', razorpayRefundId: null, amount: 9000, metadata: { reason: 'Original reason' } },
      ])
      mockPaymentService.initiateRefund.mockResolvedValue({ id: 'rfnd_retry', status: 'processed' })

      await service.cancelBooking('user-1', 'booking-1', 'Different reason — should be ignored')

      // Must NOT create a second REFUND tx
      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      // Must call Razorpay with the STORED amount (9000 * 100) not a new calculation
      expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
        'pay_abc',
        900000, // stored amount 9000 × 100 paise
        expect.objectContaining({ bookingId: 'booking-1' }),
        'razorpay',
      )
    })

    it('should retry Razorpay refund using stored reason (not caller reason) for consistency', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-cap', type: 'PAYMENT', status: 'CAPTURED', razorpayPaymentId: 'pay_abc' },
        { id: 'ptx-ref', type: 'REFUND', status: 'INITIATED', razorpayRefundId: null, amount: 9000, metadata: { reason: 'Stored reason' } },
      ])
      mockPaymentService.initiateRefund.mockResolvedValue({ id: 'rfnd_r2', status: 'processed' })

      await service.cancelBooking('user-1', 'booking-1', 'Caller reason — must be ignored on retry')

      expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
        'pay_abc',
        900000,
        expect.objectContaining({ reason: 'Stored reason' }),
        'razorpay',
      )
    })

    // ── Cashfree gateway routing ────────────────────────────────────────────

    it('should route refund to Cashfree and store provider on REFUND tx', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentService.resolveProviderFromTx.mockReturnValue('cashfree')
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        {
          id: 'ptx-cf',
          type: 'PAYMENT',
          status: 'CAPTURED',
          gatewayPaymentId: 'pay_cf_123',
          razorpayPaymentId: null,
          gatewayOrderId: 'order_cf_abc',
          razorpayOrderId: null,
          provider: 'cashfree',
        },
      ])
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund-cf' })
      mockPaymentService.initiateRefund.mockResolvedValue({ refundId: 'rfnd_cf_1', status: 'SUCCESS' })

      await service.cancelBooking('user-1', 'booking-1', 'Trip cancelled')

      // Provider stored on the REFUND tx so future retries don't need to infer it
      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'REFUND',
        status: 'INITIATED',
        provider: 'cashfree',
      }))
      // Cashfree requires orderId in notes (refunds are order-scoped)
      expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
        'pay_cf_123',
        900000,
        expect.objectContaining({ bookingId: 'booking-1', orderId: 'order_cf_abc' }),
        'cashfree',
      )
    })

    it('should route retry refund to Cashfree when INITIATED REFUND tx exists with no refundId', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentService.resolveProviderFromTx.mockReturnValue('cashfree')
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        {
          id: 'ptx-cf-cap',
          type: 'PAYMENT',
          status: 'CAPTURED',
          gatewayPaymentId: 'pay_cf_456',
          razorpayPaymentId: null,
          gatewayOrderId: 'order_cf_xyz',
          razorpayOrderId: null,
          provider: 'cashfree',
        },
        { id: 'ptx-cf-ref', type: 'REFUND', status: 'INITIATED', razorpayRefundId: null, gatewayRefundId: null, amount: 9000, metadata: { reason: 'Original reason' } },
      ])
      mockPaymentService.initiateRefund.mockResolvedValue({ refundId: 'rfnd_cf_retry', status: 'SUCCESS' })

      await service.cancelBooking('user-1', 'booking-1', 'New reason — ignored on retry')

      expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
      expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
        'pay_cf_456',
        900000,
        expect.objectContaining({ orderId: 'order_cf_xyz' }),
        'cashfree',
      )
    })

    it('should store provider=razorpay on REFUND tx for Razorpay payments', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)
      mockPaymentTxRepo.findByBookingId.mockResolvedValue([
        { id: 'ptx-rzp', type: 'PAYMENT', status: 'CAPTURED', gatewayPaymentId: 'pay_abc', razorpayPaymentId: 'pay_abc', provider: 'razorpay' },
      ])
      mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund-rzp' })
      mockPaymentService.initiateRefund.mockResolvedValue({ id: 'rfnd_x', status: 'processed' })

      await service.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'REFUND',
        status: 'INITIATED',
        provider: 'razorpay',
      }))
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
      isHidden: false,
      bookingsPausedReason: null,
      organizer: {
        id: 'org-1',
        userId: 'organizer-user-1',
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

    it('should throw ValidationError when organizer tries to book own trip', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)

      await expect(
        service.createBooking('organizer-user-1', validInput),
      ).rejects.toThrow('cannot book your own trip')
    })

    it('should create booking and Razorpay order for INSTANT trip', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({
        orderId: 'order_abc',
        status: 'created',
        clientPayload: { provider: 'razorpay', orderId: 'order_abc', razorpayKeyId: 'rzp_test_key' },
      })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-new',
        bookingRef: 'TRP-2025-0001',
        totalAmount: 8000,
        expiresAt: new Date(),
      })

      const result = await service.createBooking('user-1', validInput)

      expect(result.bookingId).toBe('booking-new')
      expect(result.razorpayOrderId).toBe('order_abc')
      // Reseller regression: no sublinkToken + no attribution → markupAmount=0,
      // sublinkId=undefined, totalAmount unchanged, no attribution arg passed.
      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: 'trip-1', userId: 'user-1', numTravelers: 2, totalAmount: 8000, sublinkId: undefined, markupAmount: 0 }),
        expect.objectContaining({ provider: 'razorpay', gatewayOrderId: 'order_abc', amount: 8000, type: 'PAYMENT', status: 'INITIATED' }),
        undefined,
      )
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaise: expect.any(Number), receipt: expect.any(String), notes: expect.any(Object) }),
      )
    })

    it('should log a warning with the orphaned gateway order details when a P2002 race fires', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({
        orderId: 'order_orphaned',
        status: 'created',
        clientPayload: { provider: 'razorpay', orderId: 'order_orphaned', razorpayKeyId: 'rzp_test_key' },
      })
      const { Prisma } = await import('@prisma/client')
      mockBookingRepo.createWithPaymentTx.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
      const warnSpy = vi.spyOn(logger, 'warn')

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('You already have an active booking for this trip')

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order_orphaned', provider: 'razorpay', tripId: 'trip-1', userId: 'user-1' }),
        expect.stringContaining('orphaned'),
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
      expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalled()
    })

    it('should not block new booking when user already has a CONFIRMED booking (re-booking for friends)', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({
        bookingStatus: 'CONFIRMED',
      })
      mockTripRepo.findByIdForBooking.mockResolvedValue(null)

      // Should skip the CONFIRMED booking and proceed to trip validation
      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('Trip') // NotFoundError — proves the CONFIRMED check no longer blocks
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

    it('should throw ValidationError when trip is hidden', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({ ...mockTrip, isHidden: true })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('not available for booking')
    })

    it('should surface paused reason in error when bookings are paused with a reason', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        acceptingBookings: false,
        bookingsPausedReason: 'Dates being revised',
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('Bookings are closed: Dates being revised')
    })

    it('should throw generic closed error when bookings are paused without a reason', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        acceptingBookings: false,
        bookingsPausedReason: null,
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('Bookings are currently closed')
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

    it('should succeed for Razorpay booking even when organizer has no razorpayAccountId', async () => {
      mockEnv.PAYMENT_GATEWAY = 'razorpay'
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        organizer: { ...mockTrip.organizer, razorpayAccountId: null },
      })
      mockPaymentService.createOrder.mockResolvedValue({
        orderId: 'order_rzp',
        status: 'created',
        clientPayload: { provider: 'razorpay', orderId: 'order_rzp', razorpayKeyId: 'rzp_test_key' },
      })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-new',
        bookingRef: 'TRP-2025-0001',
        totalAmount: 8000,
        expiresAt: new Date(),
      })

      const result = await service.createBooking('user-1', validInput)
      expect(result.bookingId).toBe('booking-new')
    })

    it('should throw ValidationError when Cashfree gateway but organizer has no cashfreeVendorId', async () => {
      mockEnv.PAYMENT_GATEWAY = 'cashfree'
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        organizer: { ...mockTrip.organizer, cashfreeVendorId: null },
      })

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('payment')

      mockEnv.PAYMENT_GATEWAY = 'razorpay'
    })

    it('should omit split in createOrder when Cashfree sandbox (Easy Split skipped until production KYC)', async () => {
      mockEnv.PAYMENT_GATEWAY = 'cashfree'
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue({
        ...mockTrip,
        organizer: { ...mockTrip.organizer, cashfreeVendorId: 'cf_vendor_sandbox_123' },
      })
      mockPaymentService.createOrder.mockResolvedValue({
        orderId: 'order_cf_sandbox',
        status: 'created',
        clientPayload: { provider: 'cashfree', orderId: 'order_cf_sandbox', paymentSessionId: 'pay_sess_123' },
      })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-cf',
        bookingRef: 'TRP-2025-0003',
        totalAmount: 8000,
        expiresAt: new Date(),
      })

      await service.createBooking('user-1', validInput)

      const callArg = mockPaymentService.createOrder.mock.calls[0][0]
      expect(callArg.split).toBeNull()
    })

    it('should use early bird price when deadline has not passed', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({
        orderId: 'order_eb',
        status: 'created',
        clientPayload: { provider: 'razorpay', orderId: 'order_eb', razorpayKeyId: 'rzp_test_key' },
      })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-eb',
        bookingRef: 'TRP-2025-0002',
        totalAmount: 8000,
        expiresAt: new Date(),
      })

      await service.createBooking('user-1', validInput)

      // Early bird: 4000 * 2 = 8000 rupees = 800000 paise
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaise: 800000 }),
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

  // ═══════════════════════════════════════════════════
  // createBooking — reseller markup resolution
  //
  // mockTrip: pricePerPerson=5000, earlyBirdPrice=4000, earlyBirdDeadline in the
  // future → isEarlyBird=true, so baseTotal for numTravelers=2 with no transfer
  // points is (4000+0+0)*2 = 8000 (matches the no-markup regression assertion
  // in "should create booking and Razorpay order for INSTANT trip" above).
  // ═══════════════════════════════════════════════════
  describe('createBooking — reseller markup resolution', () => {
    const mockResellerRepo = {
      findActiveByToken: vi.fn(),
      findAttributionByUserAndTrip: vi.fn(),
    }
    let resellerService: BookingService

    beforeEach(() => {
      mockResellerRepo.findActiveByToken.mockReset()
      mockResellerRepo.findAttributionByUserAndTrip.mockReset()
      resellerService = new BookingService(
        mockBookingRepo as any,
        mockTripRepo as any,
        mockTripRequestRepo as any,
        mockPaymentTxRepo as any,
        mockPaymentService as any,
        logger as any,
        { send: vi.fn().mockResolvedValue([]) } as any,
        null,
        null,
        null,
        mockResellerRepo as any,
      )
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({
        orderId: 'order_abc',
        status: 'created',
        clientPayload: { provider: 'razorpay', orderId: 'order_abc', razorpayKeyId: 'rzp_test_key' },
      })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-new',
        bookingRef: 'TRP-2025-0001',
        totalAmount: 8000,
        expiresAt: new Date(),
      })
    })

    it('markup>0 happy path: sublinkToken resolves to an active sublink on the same trip', async () => {
      mockResellerRepo.findActiveByToken.mockResolvedValue({ id: 'sub-1', markupAmount: 300, tripId: 'trip-1' })

      const result = await resellerService.createBooking('user-1', { ...validInput, sublinkToken: 'tok-A' })

      expect(mockResellerRepo.findActiveByToken).toHaveBeenCalledWith('tok-A', 'sublink')
      // baseTotal = 4000*2 = 8000, markupTotal = 300*2 = 600 → totalAmount = 8600
      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 8600, sublinkId: 'sub-1', markupAmount: 600 }),
        expect.any(Object),
        { userId: 'user-1', sublinkId: 'sub-1', tripId: 'trip-1' },
      )
      // Commission split computed on BASE only: baseAmountInPaise=800000, commission 10% → vendorAmountPaise unaffected by markup.
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaise: 860000 }),
      )
      expect(result.amountInRupees).toBe(8600)
    })

    it('attribution fallback: no sublinkToken but an existing SublinkAttribution for (userId, tripId) applies its markup', async () => {
      mockResellerRepo.findAttributionByUserAndTrip.mockResolvedValue({
        sublink: { id: 'sub-2', markupAmount: 200, tripId: 'trip-1', isActive: true, isDeleted: false },
      })

      await resellerService.createBooking('user-1', validInput)

      expect(mockResellerRepo.findActiveByToken).not.toHaveBeenCalled()
      expect(mockResellerRepo.findAttributionByUserAndTrip).toHaveBeenCalledWith('user-1', 'trip-1')
      // baseTotal=8000, markupTotal = 200*2=400 → totalAmount=8400. No sublinkToken → no attribution write.
      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 8400, sublinkId: 'sub-2', markupAmount: 400 }),
        expect.any(Object),
        undefined,
      )
    })

    it('ignores an inactive/deleted attributed sublink and falls back to markup=0', async () => {
      mockResellerRepo.findAttributionByUserAndTrip.mockResolvedValue({
        sublink: { id: 'sub-dead', markupAmount: 999, tripId: 'trip-1', isActive: false, isDeleted: false },
      })

      await resellerService.createBooking('user-1', validInput)

      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 8000, sublinkId: undefined, markupAmount: 0 }),
        expect.any(Object),
        undefined,
      )
    })

    it('mismatched token (sublink.tripId !== booking tripId) is ignored, not an error — proceeds at markup=0', async () => {
      mockResellerRepo.findActiveByToken.mockResolvedValue({ id: 'sub-3', markupAmount: 500, tripId: 'trip-OTHER' })
      mockResellerRepo.findAttributionByUserAndTrip.mockResolvedValue(null)

      await resellerService.createBooking('user-1', { ...validInput, sublinkToken: 'tok-mismatch' })

      // Falls through to the attribution check since the token didn't resolve to a usable sublink.
      expect(mockResellerRepo.findAttributionByUserAndTrip).toHaveBeenCalledWith('user-1', 'trip-1')
      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 8000, sublinkId: undefined, markupAmount: 0 }),
        expect.any(Object),
        undefined,
      )
    })

    it('last-wins: an explicit sublinkToken for a NEW sublink overrides a prior attribution to a different sublink', async () => {
      mockResellerRepo.findActiveByToken.mockResolvedValue({ id: 'sub-B', markupAmount: 700, tripId: 'trip-1' })
      mockResellerRepo.findAttributionByUserAndTrip.mockResolvedValue({
        sublink: { id: 'sub-A', markupAmount: 100, tripId: 'trip-1', isActive: true, isDeleted: false },
      })

      await resellerService.createBooking('user-1', { ...validInput, sublinkToken: 'tok-B' })

      // The token short-circuits the attribution lookup entirely — sub-A is never even read.
      expect(mockResellerRepo.findAttributionByUserAndTrip).not.toHaveBeenCalled()
      // baseTotal=8000, markupTotal = 700*2=1400 → totalAmount=9400, attribution write refreshes to sub-B.
      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 9400, sublinkId: 'sub-B', markupAmount: 1400 }),
        expect.any(Object),
        { userId: 'user-1', sublinkId: 'sub-B', tripId: 'trip-1' },
      )
    })

    it('markup=0 regression: byte-identical totalAmount/vendorAmountPaise when resellerRepo is wired but returns nothing', async () => {
      mockResellerRepo.findAttributionByUserAndTrip.mockResolvedValue(null)

      await resellerService.createBooking('user-1', validInput)

      expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: 'trip-1', userId: 'user-1', numTravelers: 2, totalAmount: 8000, sublinkId: undefined, markupAmount: 0 }),
        expect.any(Object),
        undefined,
      )
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: 800000 }))
    })
  })
  })

  // ═══════════════════════════════════════════════════
  // confirmBooking
  // ═══════════════════════════════════════════════════
  describe('confirmBooking', () => {
    const mockBookingWithPayment = {
      id: 'booking-1',
      userId: 'user-1',
      bookingRef: 'TRP-2025-0001',
      bookingStatus: 'PENDING_PAYMENT',
      numTravelers: 2,
      totalAmount: 8000,
      trip: {
        id: 'trip-1',
        title: 'Goa Trip',
        slug: 'goa-trip',
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
      travelerDetails: [],
      tripRequest: null,
    }

    beforeEach(() => {
      // Gate wins (1 row updated = PENDING_PAYMENT→CONFIRMED succeeded)
      mockBookingRepo.atomicConfirmGate.mockResolvedValue(1)
      // revertConfirmGate must return a Promise so .catch() works
      mockBookingRepo.revertConfirmGate.mockResolvedValue(undefined)
    })

    it('should atomically gate, increment seats, capture payment, and check FULL', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)

      const result = await service.confirmBooking('booking-1')

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(result.bookingRef).toBe('TRP-2025-0001')
      // atomicConfirmGate transitions PENDING_PAYMENT→CONFIRMED in the DB
      expect(mockBookingRepo.atomicConfirmGate).toHaveBeenCalledWith('booking-1')
      expect(mockTripRepo.atomicIncrementBookings).toHaveBeenCalledWith('trip-1', 2)
      expect(mockPaymentService.capturePayment).toHaveBeenCalledWith('pay_abc', 800000, 'INR', 'razorpay')
      expect(mockTripRepo.markFullIfAtCapacity).toHaveBeenCalledWith('trip-1')
    })

    it('should auto-transition trip to FULL when at capacity', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockTripRepo.markFullIfAtCapacity.mockResolvedValue(1)

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

    it('should return CONFIRMED idempotently without re-gating (already CONFIRMED)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        ...mockBookingWithPayment,
        bookingStatus: 'CONFIRMED',
      })

      const result = await service.confirmBooking('booking-1')

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockBookingRepo.atomicConfirmGate).not.toHaveBeenCalled()
      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })

    it('should revert gate and throw ConflictError when seats exhausted (increment returns 0)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(0)

      await expect(
        service.confirmBooking('booking-1'),
      ).rejects.toThrow('seats')

      expect(mockBookingRepo.revertConfirmGate).toHaveBeenCalledWith('booking-1')
      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })

    it('should rollback seats and revert gate when capture fails', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockPaymentService.capturePayment.mockRejectedValue(new Error('Capture failed'))
      mockTripRepo.atomicDecrementBookings.mockResolvedValue(1)

      await expect(
        service.confirmBooking('booking-1'),
      ).rejects.toThrow('Capture failed')

      expect(mockTripRepo.atomicDecrementBookings).toHaveBeenCalledWith('trip-1', 2)
      expect(mockBookingRepo.revertConfirmGate).toHaveBeenCalledWith('booking-1')
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

    it('should call markConverted with the approved request id on a REQUEST_BASED booking', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockTripRequestRepo.findApprovedForUser.mockResolvedValue({ id: 'req-1', status: 'APPROVED' })
      mockTripRequestRepo.markConverted.mockResolvedValue(undefined)

      await service.confirmBooking('booking-1')

      expect(mockTripRequestRepo.findApprovedForUser).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(mockTripRequestRepo.markConverted).toHaveBeenCalledWith('req-1', 'booking-1')
    })

    it('should not call markConverted when no approved request exists (INSTANT booking)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(mockBookingWithPayment)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockTripRequestRepo.findApprovedForUser.mockResolvedValue(null)

      await service.confirmBooking('booking-1')

      expect(mockTripRequestRepo.markConverted).not.toHaveBeenCalled()
    })

    it('should revert gate and decrement seats when razorpayPaymentId is null (payment not yet authorized)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        ...mockBookingWithPayment,
        paymentTransactions: [{
          id: 'ptx-1',
          razorpayOrderId: 'order_abc',
          razorpayPaymentId: null, // Webhook has not set the payment ID yet
          amount: 8000,
          status: 'INITIATED',
        }],
      })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)

      await expect(
        service.confirmBooking('booking-1'),
      ).rejects.toThrow('Payment has not been authorized yet')

      // Gate and seat count must be reverted so the webhook can retry
      expect(mockBookingRepo.revertConfirmGate).toHaveBeenCalledWith('booking-1')
      expect(mockTripRepo.atomicDecrementBookings).toHaveBeenCalledWith('trip-1', 2)
      // capturePayment must NOT have been called — no payment ID to use
      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // createBooking — distributed lock (TOCTOU prevention)
  // ═══════════════════════════════════════════════════
  describe('createBooking — distributed lock (TOCTOU prevention)', () => {
    const validInput = {
      tripId: 'trip-1',
      numTravelers: 2,
      travelers: [
        { name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    }

    it('should throw BOOKING_IN_PROGRESS ConflictError when Redis lock is not acquired', async () => {
      // Simulate another request already holding the lock for this user+trip
      vi.mocked(withLock).mockResolvedValueOnce(false)

      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toMatchObject({ message: expect.stringContaining('already in progress'), subCode: 'BOOKING_IN_PROGRESS' })

      // No DB writes or Razorpay calls should have happened
      expect(mockTripRepo.findByIdForBooking).not.toHaveBeenCalled()
      expect(mockPaymentService.createOrder).not.toHaveBeenCalled()
      expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalled()
    })

    it('should scope the lock key to userId and tripId so different users do not block each other', async () => {
      // Capture the lock key passed to withLock
      const capturedKeys: string[] = []
      vi.mocked(withLock).mockImplementationOnce(async (key, _ttl, fn) => {
        capturedKeys.push(key)
        await fn()
        return true
      })

      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(null) // will throw NotFoundError — we only care about key

      await service.createBooking('user-42', { ...validInput, tripId: 'trip-99' }).catch(() => {})

      expect(capturedKeys[0]).toBe('booking:create:user-42:trip-99')
    })

    it('should return existing booking when concurrent arrival passes fast-path but re-check under lock finds PENDING_PAYMENT', async () => {
      const existingBooking = {
        id: 'booking-concurrent',
        bookingRef: 'TRP-2025-RACE1',
        bookingStatus: 'PENDING_PAYMENT',
        totalAmount: 10000,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        paymentTransactions: [{ razorpayOrderId: 'order_concurrent' }],
      }
      // Fast-path: both concurrent requests see null (race window)
      // Under-lock re-check: second request finds the booking created by the first
      mockBookingRepo.findActiveByUserAndTrip
        .mockResolvedValueOnce(null)       // fast-path (before lock)
        .mockResolvedValueOnce(existingBooking) // re-check inside lock

      const result = await service.createBooking('user-1', validInput)

      expect(result.bookingId).toBe('booking-concurrent')
      expect(result.razorpayOrderId).toBe('order_concurrent')
      // No new Razorpay order or DB booking was created
      expect(mockPaymentService.createOrder).not.toHaveBeenCalled()
      expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalled()
    })

    it('should not block new booking when under-lock re-check finds a CONFIRMED booking (user booking for friends)', async () => {
      // Fast-path: sees null; under-lock: sees CONFIRMED (separate booking was confirmed concurrently)
      mockBookingRepo.findActiveByUserAndTrip
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ bookingStatus: 'CONFIRMED' })
      mockTripRepo.findByIdForBooking.mockResolvedValue(null)

      // Should proceed past the CONFIRMED booking to trip validation
      await expect(
        service.createBooking('user-1', validInput),
      ).rejects.toThrow('Trip') // NotFoundError — proves CONFIRMED didn't block

      expect(mockPaymentService.createOrder).not.toHaveBeenCalled() // didn't reach payment
    })

    it('should expire PENDING_PAYMENT booking with no expiresAt found under lock then create a fresh order', async () => {
      const staleBooking = {
        id: 'stale-booking', bookingStatus: 'PENDING_PAYMENT',
        expiresAt: null, paymentTransactions: [],
      }
      const mockTrip = {
        id: 'trip-1', status: 'ACTIVE', bookingMode: 'INSTANT',
        acceptingBookings: true, pricePerPerson: 5000,
        earlyBirdPrice: null, earlyBirdDeadline: null,
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000),
        bookingDeadline: null, maxGroupSize: 20, currentBookings: 5,
        organizer: { id: 'org-1', razorpayAccountId: 'acc_org123456789012', commissionRate: 10 },
        transferPoints: [],
      }
      // Fast-path: no active booking
      // Under-lock: finds stale booking (no expiresAt) → should expire it and proceed
      mockBookingRepo.findActiveByUserAndTrip
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(staleBooking)
      mockBookingRepo.updateStatus.mockResolvedValue({})
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({ orderId: 'order_fresh', status: 'created', clientPayload: { provider: 'razorpay', orderId: 'order_fresh', razorpayKeyId: 'rzp_test_key' } })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-fresh', bookingRef: 'TRP-2025-FRESH',
        totalAmount: 10000, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })

      const result = await service.createBooking('user-1', validInput)

      expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith('stale-booking', 'EXPIRED')
      expect(result.bookingId).toBe('booking-fresh')
      expect(mockPaymentService.createOrder).toHaveBeenCalledTimes(1)
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
      mockPaymentService.verifyClientCallback.mockResolvedValue(true)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockBookingRepo.updateStatus.mockResolvedValue({})

      const result = await service.verifyAndConfirmPayment('booking-1', 'user-1', {
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_abc',
        razorpaySignature: 'valid-sig',
      })

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockPaymentService.verifyClientCallback).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order_abc', paymentId: 'pay_abc', signature: 'valid-sig' }),
      )
    })

    it('should throw AuthError when signature is invalid', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        bookingStatus: 'PENDING_PAYMENT',
        paymentTransactions: [{ razorpayOrderId: 'order_abc' }],
      })
      mockPaymentService.verifyClientCallback.mockResolvedValue(false)

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

    it('should throw AuthError when dto.razorpayOrderId does not match stored order ID (payment replay attack)', async () => {
      // Attacker submits a valid sig from Booking A (orderId_A) against Booking B (orderId_B)
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-b',
        userId: 'user-1',
        bookingStatus: 'PENDING_PAYMENT',
        paymentTransactions: [{
          id: 'ptx-b',
          razorpayOrderId: 'order_B',   // Booking B's stored order
          razorpayPaymentId: null,
          amount: 10000,
          status: 'INITIATED',
        }],
      })
      mockPaymentService.verifyClientCallback.mockResolvedValue(true) // sig is genuinely valid — for order_A

      await expect(
        service.verifyAndConfirmPayment('booking-b', 'user-1', {
          razorpayOrderId: 'order_A',     // attacker replays order from another booking
          razorpayPaymentId: 'pay_A',
          razorpaySignature: 'valid-sig-for-order-A',
        }),
      ).rejects.toThrow('order ID does not match')

      expect(mockPaymentTxRepo.updatePaymentId).not.toHaveBeenCalled()
      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })

    it('should skip orderId check and proceed when stored paymentTransaction has no razorpayOrderId yet', async () => {
      // Edge case: payment transaction created before razorpayOrderId was persisted (migration scenario)
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        bookingStatus: 'PENDING_PAYMENT',
        numTravelers: 2,
        totalAmount: 8000,
        trip: { id: 'trip-1', version: 0 },
        paymentTransactions: [{
          id: 'ptx-1',
          razorpayOrderId: null,           // no stored orderId — skip the check
          razorpayPaymentId: null,
          amount: 8000,
          status: 'INITIATED',
        }],
      })
      mockPaymentService.verifyClientCallback.mockResolvedValue(true)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockBookingRepo.updateStatus.mockResolvedValue({})

      const result = await service.verifyAndConfirmPayment('booking-1', 'user-1', {
        razorpayOrderId: 'order_any',
        razorpayPaymentId: 'pay_any',
        razorpaySignature: 'valid-sig',
      })

      // Should proceed without throwing
      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockPaymentTxRepo.updatePaymentId).toHaveBeenCalledWith('ptx-1', 'pay_any')
    })

    it('should throw ForbiddenError when a different user tries to verify payment (IDOR)', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-owner',          // actual owner
        bookingStatus: 'PENDING_PAYMENT',
        paymentTransactions: [],
      })

      await expect(
        service.verifyAndConfirmPayment('booking-1', 'user-attacker', {
          razorpayOrderId: 'order_abc',
          razorpayPaymentId: 'pay_abc',
          razorpaySignature: 'sig',
        }),
      ).rejects.toThrow()

      expect(mockPaymentService.verifyClientCallback).not.toHaveBeenCalled()
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
      mockPaymentService.createOrder.mockResolvedValue({ orderId: 'order_tp', status: 'created', clientPayload: { provider: 'razorpay', orderId: 'order_tp', razorpayKeyId: 'rzp_test_key' } })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({ id: 'booking-tp', bookingRef: 'TRP-TP-0001', totalAmount: 10000, expiresAt: new Date() })
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
        expect.objectContaining({ amountPaise: 1140000 }),
      )
    })

    it('should set totalAmount correctly when extraCharge is 0', async () => {
      setupMocks()

      await service.createBooking('user-1', { ...validInput, pickupPointId: 'tp-3' })

      // base 5000 + pickup 0 = 5000 per person × 2 = 10000 rupees = 1000000 paise
      expect(mockPaymentService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaise: 1000000 }),
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

  // ═══════════════════════════════════════════════════
  // createBooking — seat integration
  // ═══════════════════════════════════════════════════
  describe('createBooking — seat integration', () => {
    const mockVehicleService = {
      checkSeatsAvailable: vi.fn(),
      holdSeats: vi.fn(),
      confirmSeats: vi.fn(),
      releaseSeats: vi.fn(),
      getBookingSeats: vi.fn(),
      assignTravelerToSeat: vi.fn(),
    }

    let seatService: BookingService

    const validInput = {
      tripId: 'trip-1',
      numTravelers: 2,
      travelers: [
        { name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
      seatIds: ['seat-1', 'seat-2'],
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
      endDate: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000),
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
      transferPoints: [],
    }

    beforeEach(() => {
      vi.clearAllMocks()
      seatService = new BookingService(
        mockBookingRepo as any,
        mockTripRepo as any,
        mockTripRequestRepo as any,
        mockPaymentTxRepo as any,
        mockPaymentService as any,
        logger as any,
        { send: vi.fn().mockResolvedValue([]) } as any,
        mockVehicleService as any,
      )
    })

    it('should validate seatIds.length matches numTravelers', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)

      await expect(
        seatService.createBooking('user-1', { ...validInput, seatIds: ['seat-1'] }),
      ).rejects.toThrow('seats must match')
    })

    it('should pre-check seat availability and throw ConflictError when unavailable', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockVehicleService.checkSeatsAvailable.mockResolvedValue(false)

      await expect(
        seatService.createBooking('user-1', validInput),
      ).rejects.toThrow('no longer available')

      expect(mockVehicleService.checkSeatsAvailable).toHaveBeenCalledWith(['seat-1', 'seat-2'])
      expect(mockPaymentService.createOrder).not.toHaveBeenCalled()
    })

    it('should hold seats after booking creation and link them', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockVehicleService.checkSeatsAvailable.mockResolvedValue(true)
      mockPaymentService.createOrder.mockResolvedValue({ orderId: 'order_seat', status: 'created', clientPayload: { provider: 'razorpay', orderId: 'order_seat', razorpayKeyId: 'rzp_test_key' } })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-seat',
        bookingRef: 'TRP-2025-SEAT',
        totalAmount: 10000,
        expiresAt: new Date(),
      })
      mockVehicleService.holdSeats.mockResolvedValue(undefined)

      const result = await seatService.createBooking('user-1', validInput)

      expect(result.bookingId).toBe('booking-seat')
      expect(mockVehicleService.checkSeatsAvailable).toHaveBeenCalledWith(['seat-1', 'seat-2'])
      expect(mockVehicleService.holdSeats).toHaveBeenCalledWith(['seat-1', 'seat-2'], 'user-1', 'booking-seat')
    })

    it('should expire booking when holdSeats fails and rethrow error', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockVehicleService.checkSeatsAvailable.mockResolvedValue(true)
      mockPaymentService.createOrder.mockResolvedValue({ orderId: 'order_fail', status: 'created', clientPayload: { provider: 'razorpay', orderId: 'order_fail', razorpayKeyId: 'rzp_test_key' } })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-fail',
        bookingRef: 'TRP-2025-FAIL',
        totalAmount: 10000,
        expiresAt: new Date(),
      })
      mockVehicleService.holdSeats.mockRejectedValue(new Error('Seats already taken'))
      mockBookingRepo.updateStatus.mockResolvedValue({})

      await expect(
        seatService.createBooking('user-1', validInput),
      ).rejects.toThrow('Seats already taken')

      expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith('booking-fail', 'EXPIRED')
    })

    it('should skip seat operations when seatIds is not provided', async () => {
      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({ orderId: 'order_noseat', status: 'created', clientPayload: { provider: 'razorpay', orderId: 'order_noseat', razorpayKeyId: 'rzp_test_key' } })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-noseat',
        bookingRef: 'TRP-2025-NOSEAT',
        totalAmount: 10000,
        expiresAt: new Date(),
      })

      const result = await seatService.createBooking('user-1', {
        ...validInput,
        seatIds: undefined,
      })

      expect(result.bookingId).toBe('booking-noseat')
      expect(mockVehicleService.checkSeatsAvailable).not.toHaveBeenCalled()
      expect(mockVehicleService.holdSeats).not.toHaveBeenCalled()
    })

    it('should skip seat operations when vehicleService is null', async () => {
      const serviceWithoutVehicle = new BookingService(
        mockBookingRepo as any,
        mockTripRepo as any,
        mockTripRequestRepo as any,
        mockPaymentTxRepo as any,
        mockPaymentService as any,
        logger as any,
        { send: vi.fn().mockResolvedValue([]) } as any,
        null,
      )

      mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
      mockTripRepo.findByIdForBooking.mockResolvedValue(mockTrip)
      mockPaymentService.createOrder.mockResolvedValue({ orderId: 'order_null', status: 'created', clientPayload: { provider: 'razorpay', orderId: 'order_null', razorpayKeyId: 'rzp_test_key' } })
      mockBookingRepo.createWithPaymentTx.mockResolvedValue({
        id: 'booking-null',
        bookingRef: 'TRP-2025-NULL',
        totalAmount: 10000,
        expiresAt: new Date(),
      })

      const result = await serviceWithoutVehicle.createBooking('user-1', {
        ...validInput,
        seatIds: ['seat-1', 'seat-2'],
      })

      expect(result.bookingId).toBe('booking-null')
      expect(mockVehicleService.checkSeatsAvailable).not.toHaveBeenCalled()
    })
  })
})

// ═══════════════════════════════════════════════════════
// Redis Cache Invalidation Tests
// ═══════════════════════════════════════════════════════

describe('BookingService — Redis Cache Invalidation', () => {
  const mockCacheService = {
    getOrSet: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    invalidateByPrefix: vi.fn(),
  }

  let cachedService: BookingService

  const futureTrip = {
    ...createMockBooking().trip,
    startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    cachedService = new BookingService(
      mockBookingRepo as any,
      mockTripRepo as any,
      mockTripRequestRepo as any,
      mockPaymentTxRepo as any,
      mockPaymentService as any,
      logger as any,
      { send: vi.fn().mockResolvedValue([]) } as any,
      null,
      mockCacheService as any,
    )
    mockCacheService.invalidateByPrefix.mockResolvedValue(0)
    mockCacheService.del.mockResolvedValue(undefined)
  })

  describe('cancelBooking — cache invalidation', () => {
    it('should invalidate trip caches after cancellation', async () => {
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)

      await cachedService.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('cache:trips:*')
      expect(mockCacheService.del).toHaveBeenCalledWith('cache:trips:detail:goa-beach-getaway-dec-2025')
    })

    it('should not call cache when cache is null', async () => {
      const noCacheService = new BookingService(
        mockBookingRepo as any,
        mockTripRepo as any,
        mockTripRequestRepo as any,
        mockPaymentTxRepo as any,
        mockPaymentService as any,
        logger as any,
        { send: vi.fn().mockResolvedValue([]) } as any,
      )
      const booking = createMockBooking({ trip: futureTrip })
      mockBookingRepo.findById.mockResolvedValue(booking)

      await noCacheService.cancelBooking('user-1', 'booking-1', 'Changed plans')

      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled()
    })
  })
})

// ═══════════════════════════════════════════════════
// syncPaymentStatus
// ═══════════════════════════════════════════════════
describe('syncPaymentStatus', () => {
  const pendingBooking = {
    id: 'booking-1',
    userId: 'user-1',
    bookingStatus: 'PENDING_PAYMENT',
    numTravelers: 2,
    paymentTransactions: [{
      id: 'ptx-1',
      razorpayOrderId: 'order_abc',
      razorpayPaymentId: 'pay_abc',
      amount: 5000,
      status: 'AUTHORIZED',
    }],
    trip: { id: 'trip-1', currentBookings: 3, version: 0 },
    travelerDetails: [],
    tripRequest: null,
  }

  beforeEach(() => {
    // vi.clearAllMocks() doesn't flush mockResolvedValueOnce queues — reset to prevent bleed-through
    mockBookingRepo.findWithPaymentDetails.mockReset()
  })

  it('should recover and return CONFIRMED when Razorpay order is paid', async () => {
    // syncPaymentStatus fetches once; recoverPaidBooking + confirmBooking both get the preloaded booking
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(pendingBooking)
    mockPaymentService.checkOrderStatus.mockResolvedValue('paid')
    mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
    mockBookingRepo.atomicConfirmGate.mockResolvedValue(1)
    mockBookingRepo.revertConfirmGate.mockResolvedValue(undefined)
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)

    const result = await service.syncPaymentStatus('booking-1', 'user-1')

    expect(result.bookingStatus).toBe('CONFIRMED')
    expect(mockPaymentService.checkOrderStatus).toHaveBeenCalledWith('order_abc', 'razorpay')
  })

    it('should return CONFIRMED idempotently when booking is already confirmed', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        ...pendingBooking,
        bookingStatus: 'CONFIRMED',
        paymentTransactions: [{ ...pendingBooking.paymentTransactions[0], status: 'CAPTURED' }],
      })

      const result = await service.syncPaymentStatus('booking-1', 'user-1')

      expect(result.bookingStatus).toBe('CONFIRMED')
      expect(mockPaymentService.checkOrderStatus).not.toHaveBeenCalled()
    })

    it('should throw NotFoundError when booking does not exist', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(null)

      await expect(service.syncPaymentStatus('nonexistent', 'user-1')).rejects.toThrow('Booking')
    })

    it('should throw ForbiddenError when user does not own the booking', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({ ...pendingBooking, userId: 'other-user' })

      await expect(service.syncPaymentStatus('booking-1', 'user-1')).rejects.toThrow('only sync your own')
    })

    it('should throw ValidationError when Razorpay order is not yet paid', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(pendingBooking)
      mockPaymentService.checkOrderStatus.mockResolvedValue('created')

      await expect(service.syncPaymentStatus('booking-1', 'user-1')).rejects.toThrow('not completed yet')
    })

    it('should throw ValidationError when booking has no Razorpay order', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue({
        ...pendingBooking,
        paymentTransactions: [],
      })

      await expect(service.syncPaymentStatus('booking-1', 'user-1')).rejects.toThrow('No payment order found')
    })
  })

  // ═══════════════════════════════════════════════════
  // recoverPaidBooking
  // ═══════════════════════════════════════════════════
  describe('recoverPaidBooking', () => {
    const bookingWithPaymentId = {
      id: 'booking-1',
      userId: 'user-1',
      bookingStatus: 'PENDING_PAYMENT',
      paymentTransactions: [{
        id: 'ptx-1',
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_abc',
        amount: 5000,
        status: 'AUTHORIZED',
      }],
      trip: { id: 'trip-1', currentBookings: 3, version: 0 },
      numTravelers: 2,
      travelerDetails: [],
      tripRequest: null,
    }

    // Factory — service mutates paymentTx.razorpayPaymentId in-place, so each test needs a fresh copy
    const makeMissingPaymentId = () => ({
      ...bookingWithPaymentId,
      paymentTransactions: [{
        ...bookingWithPaymentId.paymentTransactions[0],
        razorpayPaymentId: null,
      }],
    })

    beforeEach(() => {
      mockBookingRepo.atomicConfirmGate.mockResolvedValue(1)
      mockBookingRepo.revertConfirmGate.mockResolvedValue(undefined)
      mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
      mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
    })

    it('should confirm directly when razorpayPaymentId is already stored', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(bookingWithPaymentId)

      await service.recoverPaidBooking('booking-1', bookingWithPaymentId as any)

      expect(mockPaymentService.fetchPaymentIdForOrder).not.toHaveBeenCalled()
      expect(mockPaymentService.capturePayment).toHaveBeenCalledWith('pay_abc', 500000, 'INR', 'razorpay')
    })

    it('should fetch, store, and use paymentId when it is missing from DB', async () => {
      mockPaymentService.fetchPaymentIdForOrder.mockResolvedValue('pay_recovered')
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue(undefined)
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(makeMissingPaymentId())

      await service.recoverPaidBooking('booking-1', makeMissingPaymentId() as any)

      expect(mockPaymentService.fetchPaymentIdForOrder).toHaveBeenCalledWith('order_abc', 'razorpay')
      expect(mockPaymentTxRepo.updatePaymentId).toHaveBeenCalledWith('ptx-1', 'pay_recovered')
      expect(mockPaymentService.capturePayment).toHaveBeenCalledWith('pay_recovered', 500000, 'INR', 'razorpay')
    })

    it('should throw ValidationError when fetchPaymentIdForOrder returns null', async () => {
      mockPaymentService.fetchPaymentIdForOrder.mockResolvedValue(null)

      await expect(
        service.recoverPaidBooking('booking-1', makeMissingPaymentId() as any),
      ).rejects.toThrow('Payment ID not found on gateway yet')

      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })

    it('should return silently when booking not found and no preloaded booking given', async () => {
      mockBookingRepo.findWithPaymentDetails.mockResolvedValue(null)

      await expect(service.recoverPaidBooking('nonexistent')).resolves.toBeUndefined()
    })

    it('should return silently when booking has no payment transaction', async () => {
      const bookingNoTx = { ...bookingWithPaymentId, paymentTransactions: [] }

      await expect(
        service.recoverPaidBooking('booking-1', bookingNoTx as any),
      ).resolves.toBeUndefined()

      expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    })
  })

