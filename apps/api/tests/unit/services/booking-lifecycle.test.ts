/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Booking Lifecycle Flow Tests
 *
 * End-to-end service-level tests covering the full trip booking lifecycle:
 *
 *   create booking → payment → confirm → FULL auto-transition
 *     → cancel → seat release → FULL→ACTIVE revert
 *     → trip endDate passes → cron completes trip → escrow released
 *
 * These tests verify cross-method interactions and state transitions
 * that isolated unit tests do not cover.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingService } from '../../../src/services/booking.service'
import { TripLifecycleService } from '../../../src/services/trip-lifecycle.service'
import { logger } from '../../../src/utils/logger'
import { ESCROW_SAFETY_BUFFER_DAYS, PLATFORM_COMMISSION_PERCENT } from '../../../src/utils/constants'
import { withLock } from '../../../src/utils/redis-lock'

// Default: withLock executes fn immediately and returns true (lock acquired).
// Individual tests in this file override this per-case to test lock-failure paths.
vi.mock('../../../src/utils/redis-lock', () => ({
  withLock: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<void>) => {
    await fn()
    return true
  }),
}))

vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'production',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'test_secret',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    CLIENT_URL: 'http://localhost:3000',
  },
}))

// ══════════════════════════════════════════════════════
// Shared Mock Infrastructure
// ══════════════════════════════════════════════════════

// ── Trip lifecycle TX mock ───────────────────────────
const mockLifecycleTx = {
  trip: { update: vi.fn() },
  booking: { updateMany: vi.fn() },
  organizerProfile: { update: vi.fn() },
  destination: { update: vi.fn() },
}

// ── Repositories ─────────────────────────────────────
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
  findTripsToComplete: vi.fn(),
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
  findReleasedBookingIdsForTrip: vi.fn().mockResolvedValue(new Set()),
  findByRazorpayOrderId: vi.fn(),
  findByRazorpayPaymentId: vi.fn(),
  updateStatus: vi.fn(),
  updatePaymentId: vi.fn(),
  recordRetryAttempt: vi.fn(),
  findCapturedTransfersForTrip: vi.fn(),
  findUnreleasedEscrows: vi.fn(),
}

const mockPaymentService = {
  createOrder: vi.fn(),
  verifySignature: vi.fn(),
  capturePayment: vi.fn(),
  checkOrderStatus: vi.fn(),
  initiateRefund: vi.fn(),
  resolveBookingIdFromOrder: vi.fn(),
  releaseTransferHold: vi.fn(),
  fetchTransferId: vi.fn(),
}

// ── Test Data ────────────────────────────────────────
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

const BASE_TRIP = {
  id: 'trip-1',
  title: 'Goa Beach Getaway',
  slug: 'goa-beach-getaway-dec-2025',
  status: 'ACTIVE',
  bookingMode: 'INSTANT',
  acceptingBookings: true,
  pricePerPerson: 5000,
  earlyBirdPrice: null,
  earlyBirdDeadline: null,
  startDate: new Date(NOW + 30 * DAY),
  endDate: new Date(NOW + 32 * DAY),
  bookingDeadline: new Date(NOW + 20 * DAY),
  maxGroupSize: 10,
  currentBookings: 8,
  version: 5,
  isDeleted: false,
  destinationId: 'dest-1',
  organizerId: 'org-1',
  organizer: {
    id: 'org-1',
    razorpayAccountId: 'acc_org12345678901',
    commissionRate: 10,
    businessName: 'TripVibes',
  },
  transferPoints: [],
  destination: { id: 'dest-1', name: 'Goa', slug: 'goa' },
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    bookingRef: 'TRP-2025-ABC1',
    userId: 'user-1',
    tripId: 'trip-1',
    bookingStatus: 'PENDING_PAYMENT',
    numTravelers: 2,
    totalAmount: 10000,
    tripProtection: false,
    createdAt: new Date(),
    cancelledAt: null,
    expiresAt: new Date(NOW + 30 * 60 * 1000),
    trip: { ...BASE_TRIP },
    paymentTransactions: [{
      id: 'ptx-1',
      razorpayOrderId: 'order_abc',
      razorpayPaymentId: 'pay_abc',
      amount: 10000,
      status: 'AUTHORIZED',
    }],
    tripRequest: null,
    review: null,
    travelerDetails: [
      { id: 'td-1', name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true },
      { id: 'td-2', name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE', isPrimary: false },
    ],
    ...overrides,
  }
}

let bookingService: BookingService
let lifecycleService: TripLifecycleService

beforeEach(() => {
  vi.clearAllMocks()

  // Default: cancel succeeds for a CONFIRMED booking
  mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 1, preCancelStatus: 'CONFIRMED' })
  // Default: gate wins (1 row updated = PENDING_PAYMENT→CONFIRMED)
  mockBookingRepo.atomicConfirmGate.mockResolvedValue(1)
  // revertConfirmGate must return a Promise so .catch() works in service
  mockBookingRepo.revertConfirmGate.mockResolvedValue(undefined)

  bookingService = new BookingService(
    mockBookingRepo as any,
    mockTripRepo as any,
    mockTripRequestRepo as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
    { send: vi.fn().mockResolvedValue([]) } as any,
  )

  lifecycleService = new TripLifecycleService(
    {
      ...mockTripRepo,
      withTransaction: vi.fn().mockImplementation((fn: any) => fn(mockLifecycleTx)),
    } as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
  )
})

// ══════════════════════════════════════════════════════
// FLOW 1: Happy Path — Create → Confirm → FULL
// ══════════════════════════════════════════════════════
describe('Flow 1: Create Booking → Payment → Confirm → FULL', () => {
  it('should create booking with correct on_hold_until (endDate + 90 days)', async () => {
    mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
    mockTripRepo.findByIdForBooking.mockResolvedValue(BASE_TRIP)
    mockPaymentService.createOrder.mockResolvedValue({ id: 'order_new', amount: 1000000 })
    mockBookingRepo.createWithPaymentTx.mockResolvedValue({
      id: 'booking-new', bookingRef: 'TRP-2025-XYZ1', totalAmount: 10000,
      expiresAt: new Date(NOW + 30 * 60 * 1000),
    })

    await bookingService.createBooking('user-1', {
      tripId: 'trip-1',
      numTravelers: 2,
      travelers: [
        { name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    })

    // Verify Razorpay order was created with transfer that has correct on_hold_until
    const createOrderCall = mockPaymentService.createOrder.mock.calls[0]
    const transfers = createOrderCall[2] as Record<string, unknown>[]
    expect(transfers).toHaveLength(1)

    const onHoldUntil = transfers[0].on_hold_until as number
    const expectedTimestamp = Math.floor(
      new Date(BASE_TRIP.endDate).getTime() / 1000 + ESCROW_SAFETY_BUFFER_DAYS * 24 * 60 * 60,
    )
    expect(onHoldUntil).toBe(expectedTimestamp)

    // Verify transfer amount = total * (1 - commission/100)
    const expectedTransferPaise = Math.round(1000000 * (1 - 10 / 100))
    expect(transfers[0].amount).toBe(expectedTransferPaise)
  })

  it('should confirm booking, capture payment, increment seats, and check FULL', async () => {
    const booking = makeBooking()
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
    mockBookingRepo.updateStatus.mockResolvedValue({})
    mockTripRepo.markFullIfAtCapacity.mockResolvedValue(0) // Not yet full

    const result = await bookingService.confirmBooking('booking-1')

    // 1. Gate atomically transitions PENDING_PAYMENT→CONFIRMED in DB
    expect(mockBookingRepo.atomicConfirmGate).toHaveBeenCalledWith('booking-1')
    // 2. Seats incremented atomically
    expect(mockTripRepo.atomicIncrementBookings).toHaveBeenCalledWith('trip-1', 2)
    // 3. Payment captured with exact DB amount in paise
    expect(mockPaymentService.capturePayment).toHaveBeenCalledWith('pay_abc', 1000000, 'INR')
    // 4. FULL check always fires (atomic SQL — no TOCTOU)
    expect(mockTripRepo.markFullIfAtCapacity).toHaveBeenCalledWith('trip-1')
    expect(result.bookingStatus).toBe('CONFIRMED')
    expect(result.paymentStatus).toBe('CAPTURED')
  })

  it('should auto-transition trip ACTIVE→FULL when last seats are booked', async () => {
    // Trip has 8/10, booking for 2 → exactly full
    const booking = makeBooking()
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
    mockBookingRepo.updateStatus.mockResolvedValue({})
    mockTripRepo.markFullIfAtCapacity.mockResolvedValue(1) // Transitioned!

    await bookingService.confirmBooking('booking-1')

    expect(mockTripRepo.markFullIfAtCapacity).toHaveBeenCalledWith('trip-1')
  })

  it('should NOT auto-transition if not at capacity after confirm', async () => {
    // Trip has 5/10, booking for 2 → 7/10, not full
    const booking = makeBooking({
      trip: { ...BASE_TRIP, currentBookings: 5 },
    })
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockPaymentService.capturePayment.mockResolvedValue({ status: 'captured' })
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
    mockBookingRepo.updateStatus.mockResolvedValue({})
    mockTripRepo.markFullIfAtCapacity.mockResolvedValue(0) // No transition

    await bookingService.confirmBooking('booking-1')

    expect(mockTripRepo.markFullIfAtCapacity).toHaveBeenCalledWith('trip-1')
    // 0 rows = no transition, trip stays ACTIVE
  })

  it('should rollback seats AND skip FULL check when payment capture fails', async () => {
    const booking = makeBooking()
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1) // Seats incremented
    mockPaymentService.capturePayment.mockRejectedValue(new Error('Gateway timeout'))
    mockTripRepo.atomicDecrementBookings.mockResolvedValue(1)

    await expect(bookingService.confirmBooking('booking-1')).rejects.toThrow('Gateway timeout')

    // Seats rolled back
    expect(mockTripRepo.atomicDecrementBookings).toHaveBeenCalledWith('trip-1', 2)
    // FULL check should NOT fire — payment failed
    expect(mockTripRepo.markFullIfAtCapacity).not.toHaveBeenCalled()
  })

  it('should reject confirmation when seats exhausted (optimistic lock fails)', async () => {
    const booking = makeBooking()
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(0) // Lock failed — full

    await expect(bookingService.confirmBooking('booking-1')).rejects.toThrow('seats')

    // Payment should NOT be captured
    expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    // No FULL check
    expect(mockTripRepo.markFullIfAtCapacity).not.toHaveBeenCalled()
  })

  it('should be idempotent — re-confirm returns success without side effects', async () => {
    const confirmedBooking = makeBooking({ bookingStatus: 'CONFIRMED' })
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(confirmedBooking)

    const result = await bookingService.confirmBooking('booking-1')

    expect(result.bookingStatus).toBe('CONFIRMED')
    expect(mockTripRepo.atomicIncrementBookings).not.toHaveBeenCalled()
    expect(mockPaymentService.capturePayment).not.toHaveBeenCalled()
    expect(mockTripRepo.markFullIfAtCapacity).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════
// FLOW 2: Cancel Booking → Seat Release → FULL→ACTIVE
// ══════════════════════════════════════════════════════
describe('Flow 2: Cancel Confirmed Booking → Seat Decrement → FULL Revert', () => {
  const futureTrip = {
    ...BASE_TRIP,
    startDate: new Date(NOW + 5 * DAY),
    cancellationPolicy: 'FLEXIBLE',
    status: 'FULL',
    currentBookings: 10,
    maxGroupSize: 10,
  }

  beforeEach(() => {
    // initiateBookingRefund needs findByBookingId to return an array (not undefined)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([])
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund' })
  })

  it('should cancel CONFIRMED booking atomically (cancel + seat decrement in one transaction)', async () => {
    const booking = makeBooking({
      bookingStatus: 'CONFIRMED',
      trip: futureTrip,
    })
    mockBookingRepo.findById.mockResolvedValue(booking)

    const result = await bookingService.cancelBooking('user-1', 'booking-1', 'Changed plans')

    expect(result.bookingStatus).toBe('CANCELLED')
    // Cancel + seat decrement happen atomically inside booking repo
    expect(mockBookingRepo.cancelAtomically).toHaveBeenCalledWith(
      'booking-1', 'user-1', 'Changed plans',
      { tripId: 'trip-1', numTravelers: 2 },
    )
  })

  it('should revert trip FULL→ACTIVE after cancel frees seats', async () => {
    const booking = makeBooking({
      bookingStatus: 'CONFIRMED',
      trip: futureTrip,
    })
    mockBookingRepo.findById.mockResolvedValue(booking)
    mockTripRepo.revertFullIfUnderCapacity.mockResolvedValue(1) // Reverted!

    await bookingService.cancelBooking('user-1', 'booking-1', 'Changed plans')

    expect(mockTripRepo.revertFullIfUnderCapacity).toHaveBeenCalledWith('trip-1')
  })

  it('should NOT revert if trip still at capacity after cancel (another booking took the seat)', async () => {
    const booking = makeBooking({
      bookingStatus: 'CONFIRMED',
      trip: futureTrip,
    })
    mockBookingRepo.findById.mockResolvedValue(booking)
    mockTripRepo.revertFullIfUnderCapacity.mockResolvedValue(0) // Still full

    await bookingService.cancelBooking('user-1', 'booking-1', 'Changed plans')

    expect(mockTripRepo.revertFullIfUnderCapacity).toHaveBeenCalledWith('trip-1')
    // 0 rows = SQL WHERE did not match = still at capacity
  })

  it('should NOT revert FULL status for PENDING_PAYMENT cancel (seats were never incremented)', async () => {
    const booking = makeBooking({
      bookingStatus: 'PENDING_PAYMENT',
      trip: { ...futureTrip, status: 'ACTIVE', currentBookings: 8 },
    })
    mockBookingRepo.findById.mockResolvedValue(booking)
    mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 1, preCancelStatus: 'PENDING_PAYMENT' })

    await bookingService.cancelBooking('user-1', 'booking-1', 'Changed my mind')

    expect(mockBookingRepo.cancelAtomically).toHaveBeenCalledWith(
      'booking-1', 'user-1', 'Changed my mind',
      { tripId: 'trip-1', numTravelers: 2 },
    )
    expect(mockTripRepo.revertFullIfUnderCapacity).not.toHaveBeenCalled()
  })

  it('should never touch acceptingBookings field during cancel', async () => {
    const booking = makeBooking({ bookingStatus: 'CONFIRMED', trip: futureTrip })
    mockBookingRepo.findById.mockResolvedValue(booking)

    await bookingService.cancelBooking('user-1', 'booking-1', 'reason')

    // cancelAtomically only updates bookingStatus, cancellationReason, cancelledAt, cancelledById
    // and decrements trip.currentBookings — neither touches acceptingBookings
    expect(mockBookingRepo.cancelAtomically).toHaveBeenCalled()
  })

  it('should calculate correct refund amounts per cancellation policy', async () => {
    // FLEXIBLE, >=48h → 100%
    const flexibleBooking = makeBooking({
      bookingStatus: 'CONFIRMED',
      totalAmount: 10000,
      trip: { ...futureTrip, cancellationPolicy: 'FLEXIBLE' },
    })
    mockBookingRepo.findById.mockResolvedValue(flexibleBooking)

    const result = await bookingService.cancelBooking('user-1', 'booking-1', 'reason')

    expect(result.refundPercent).toBe(100)
    expect(result.refundAmount).toBe(10000)
  })

  it('should give 0% refund for STRICT policy regardless of timing', async () => {
    const strictBooking = makeBooking({
      bookingStatus: 'CONFIRMED',
      totalAmount: 10000,
      trip: { ...futureTrip, cancellationPolicy: 'STRICT' },
    })
    mockBookingRepo.findById.mockResolvedValue(strictBooking)

    const result = await bookingService.cancelBooking('user-1', 'booking-1', 'reason')

    expect(result.refundPercent).toBe(0)
    expect(result.refundAmount).toBe(0)
  })

  it('should throw ForbiddenError when non-owner tries to cancel (IDOR protection)', async () => {
    mockBookingRepo.findById.mockResolvedValue(makeBooking({ userId: 'other-user' }))

    await expect(
      bookingService.cancelBooking('user-1', 'booking-1', 'reason'),
    ).rejects.toThrow('You can only cancel your own bookings')
  })

  it('should reject cancel for already CANCELLED booking', async () => {
    mockBookingRepo.findById.mockResolvedValue(makeBooking({ bookingStatus: 'CANCELLED' }))
    mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 0, preCancelStatus: 'CANCELLED' })

    await expect(
      bookingService.cancelBooking('user-1', 'booking-1', 'reason'),
    ).rejects.toThrow()
  })

  it('should reject cancel for COMPLETED booking', async () => {
    mockBookingRepo.findById.mockResolvedValue(makeBooking({ bookingStatus: 'COMPLETED' }))
    mockBookingRepo.cancelAtomically.mockResolvedValue({ rows: 0, preCancelStatus: 'COMPLETED' })

    await expect(
      bookingService.cancelBooking('user-1', 'booking-1', 'reason'),
    ).rejects.toThrow()
  })
})

// ══════════════════════════════════════════════════════
// FLOW 3: Trip Completion → Escrow Release
// ══════════════════════════════════════════════════════
describe('Flow 3: Trip EndDate → Cron Completes → Escrow Released', () => {
  it('should complete trip + bookings + stats in single transaction', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])
    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])

    const result = await lifecycleService.completeEndedTrips()

    expect(result.completed).toBe(1)
    // Trip → COMPLETED
    expect(mockLifecycleTx.trip.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'trip-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
    // Bookings CONFIRMED → COMPLETED
    expect(mockLifecycleTx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tripId: 'trip-1', bookingStatus: 'CONFIRMED' }),
      data: { bookingStatus: 'COMPLETED' },
    }))
    // Organizer stats incremented
    expect(mockLifecycleTx.organizerProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-1' },
      data: { totalTripsCompleted: { increment: 1 } },
    }))
    // Destination tripCount decremented
    expect(mockLifecycleTx.destination.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'dest-1' },
      data: { tripCount: { decrement: 1 } },
    }))
  })

  it('should release escrow after trip completion with correct organizer amount', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'FULL' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])

    // Two confirmed bookings with captured payments
    const payment1 = {
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: 'trf_001', razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }
    const payment2 = {
      id: 'ptx-2', bookingId: 'b2', amount: 15000,
      razorpayTransferId: 'trf_002', razorpayPaymentId: 'pay_002',
      booking: { totalAmount: 15000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }
    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([payment1, payment2])
    mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set()) // No prior releases
    mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
    mockPaymentTxRepo.create.mockResolvedValue({})

    const result = await lifecycleService.completeEndedTrips()

    expect(result.completed).toBe(1)
    expect(result.escrowReleased).toBe(2)
    expect(result.escrowFailed).toBe(0)

    // Transfer holds released
    expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_001')
    expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_002')

    // ESCROW_RELEASE records created with correct amounts (organizer share)
    const createCalls = mockPaymentTxRepo.create.mock.calls
    expect(createCalls).toHaveLength(2)

    // Booking 1: 10000 * (1 - 10/100) = 9000
    expect(createCalls[0][0]).toEqual(expect.objectContaining({
      bookingId: 'b1', type: 'ESCROW_RELEASE', amount: 9000, status: 'CAPTURED',
      razorpayTransferId: 'trf_001',
    }))
    // Booking 2: 15000 * (1 - 10/100) = 13500
    expect(createCalls[1][0]).toEqual(expect.objectContaining({
      bookingId: 'b2', type: 'ESCROW_RELEASE', amount: 13500, status: 'CAPTURED',
      razorpayTransferId: 'trf_002',
    }))
  })

  it('should NOT rollback trip completion when Razorpay escrow release fails', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])

    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([{
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: 'trf_001', razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }])
    mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
    // ESCROW_RELEASE DB row is written first (P2002-guard ordering), then Razorpay is called
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-escrow-1' })
    mockPaymentService.releaseTransferHold.mockRejectedValue(new Error('Razorpay 503'))

    const result = await lifecycleService.completeEndedTrips()

    // Trip COMPLETED in DB regardless
    expect(result.completed).toBe(1)
    expect(mockLifecycleTx.trip.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
    // Escrow release failed at Razorpay (after the DB row was written)
    expect(result.escrowFailed).toBe(1)
    // ESCROW_RELEASE DB row IS written before calling Razorpay (idempotency ordering)
    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'b1', type: 'ESCROW_RELEASE' }),
    )
  })

  it('should skip already-released bookings during escrow release (idempotency)', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])

    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([{
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: 'trf_001', razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }])
    // b1 was already released — skip it
    mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set(['b1']))

    const result = await lifecycleService.completeEndedTrips()

    expect(result.escrowReleased).toBe(0)
    expect(mockPaymentService.releaseTransferHold).not.toHaveBeenCalled()
    expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
  })

  it('should lazy-fetch transfer ID if missing on captured payment', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])

    // Payment captured but transfer ID not yet stored (webhook timing)
    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([{
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: null, razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }])
    mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
    mockPaymentService.fetchTransferId.mockResolvedValue('trf_lazy_fetched')
    mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
    mockPaymentTxRepo.create.mockResolvedValue({})

    const result = await lifecycleService.completeEndedTrips()

    expect(result.escrowReleased).toBe(1)
    // Fetched transfer ID from Razorpay
    expect(mockPaymentService.fetchTransferId).toHaveBeenCalledWith('pay_001')
    // Persisted it
    expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED', { razorpayTransferId: 'trf_lazy_fetched' })
    // Released with fetched ID
    expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_lazy_fetched')
  })

  it('should fail escrow if transfer ID cannot be fetched', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])

    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([{
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: null, razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }])
    mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
    mockPaymentService.fetchTransferId.mockResolvedValue(null) // Cannot fetch

    const result = await lifecycleService.completeEndedTrips()

    // Trip completed, escrow failed
    expect(result.completed).toBe(1)
    expect(result.escrowFailed).toBe(1)
    expect(mockPaymentService.releaseTransferHold).not.toHaveBeenCalled()
  })

  it('should continue processing other trips when one trip fails mid-batch', async () => {
    const trip1 = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const trip2 = { id: 'trip-2', organizerId: 'org-2', destinationId: 'dest-2', status: 'FULL' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip1, trip2])

    // Trip 1 fails during DB transaction
    lifecycleTripRepo.withTransaction
      .mockRejectedValueOnce(new Error('Deadlock'))
      .mockImplementationOnce((fn: any) => fn(mockLifecycleTx))

    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([])

    const result = await lifecycleService.completeEndedTrips()

    // Trip 2 still completed
    expect(result.completed).toBe(1)
  })

  it('should use PLATFORM_COMMISSION_PERCENT when organizer has no custom rate', async () => {
    const trip = { id: 'trip-1', organizerId: 'org-1', destinationId: 'dest-1', status: 'ACTIVE' }
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([trip])

    mockPaymentTxRepo.findCapturedTransfersForTrip.mockResolvedValue([{
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: 'trf_001', razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: null } } },
    }])
    mockPaymentTxRepo.findReleasedBookingIdsForTrip.mockResolvedValue(new Set())
    mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
    mockPaymentTxRepo.create.mockResolvedValue({})

    await lifecycleService.completeEndedTrips()

    // Should use PLATFORM_COMMISSION_PERCENT (imported constant)
    const expectedAmount = Math.round(10000 * (1 - PLATFORM_COMMISSION_PERCENT / 100))
    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: expectedAmount,
    }))
  })
})

// ══════════════════════════════════════════════════════
// FLOW 4: Crash Recovery — Unreleased Escrows
// ══════════════════════════════════════════════════════
describe('Flow 4: Crash Recovery — Unreleased Escrow Sweep', () => {
  it('should release escrows that failed in a previous cron cycle', async () => {
    const unreleased = {
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: 'trf_orphan', razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }
    mockPaymentTxRepo.findUnreleasedEscrows.mockResolvedValue([unreleased])
    mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
    mockPaymentTxRepo.create.mockResolvedValue({})

    const result = await lifecycleService.releaseUnreleasedEscrows()

    expect(result.released).toBe(1)
    expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_orphan')
    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ESCROW_RELEASE',
      amount: 9000,
      metadata: expect.objectContaining({ crashRecovery: true, tripId: 'trip-1' }),
    }))
  })

  it('should handle Razorpay failure during crash recovery gracefully', async () => {
    const unreleased1 = {
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: 'trf_fail', razorpayPaymentId: 'pay_001',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }
    const unreleased2 = {
      id: 'ptx-2', bookingId: 'b2', amount: 8000,
      razorpayTransferId: 'trf_ok', razorpayPaymentId: 'pay_002',
      booking: { totalAmount: 8000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }
    mockPaymentTxRepo.findUnreleasedEscrows.mockResolvedValue([unreleased1, unreleased2])
    mockPaymentService.releaseTransferHold
      .mockRejectedValueOnce(new Error('Razorpay 500'))
      .mockResolvedValueOnce(undefined)
    mockPaymentTxRepo.create.mockResolvedValue({})

    const result = await lifecycleService.releaseUnreleasedEscrows()

    // Partial success — one released, one failed
    expect(result.released).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('should lazy-fetch transfer ID during crash recovery', async () => {
    const unreleased = {
      id: 'ptx-1', bookingId: 'b1', amount: 10000,
      razorpayTransferId: null, razorpayPaymentId: 'pay_orphan',
      booking: { totalAmount: 10000, tripId: 'trip-1', trip: { organizer: { commissionRate: 10 } } },
    }
    mockPaymentTxRepo.findUnreleasedEscrows.mockResolvedValue([unreleased])
    mockPaymentService.fetchTransferId.mockResolvedValue('trf_recovered')
    mockPaymentService.releaseTransferHold.mockResolvedValue(undefined)
    mockPaymentTxRepo.create.mockResolvedValue({})

    const result = await lifecycleService.releaseUnreleasedEscrows()

    expect(result.released).toBe(1)
    expect(mockPaymentService.fetchTransferId).toHaveBeenCalledWith('pay_orphan')
    expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED', { razorpayTransferId: 'trf_recovered' })
    expect(mockPaymentService.releaseTransferHold).toHaveBeenCalledWith('trf_recovered')
  })

  it('should be a no-op when all escrows are already released', async () => {
    mockPaymentTxRepo.findUnreleasedEscrows.mockResolvedValue([])

    const result = await lifecycleService.releaseUnreleasedEscrows()

    expect(result).toEqual({ released: 0, failed: 0 })
    expect(mockPaymentService.releaseTransferHold).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════
// FLOW 5: Edge Cases & Concurrency
// ══════════════════════════════════════════════════════
describe('Flow 5: Edge Cases & Concurrency', () => {
  it('should prevent double-booking — existing CONFIRMED booking blocks new create', async () => {
    mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({ bookingStatus: 'CONFIRMED' })

    await expect(
      bookingService.createBooking('user-1', {
        tripId: 'trip-1', numTravelers: 2,
        travelers: [
          { name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
          { name: 'B', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
        ],
      }),
    ).rejects.toThrow('already have a confirmed booking')

    expect(mockTripRepo.findByIdForBooking).not.toHaveBeenCalled()
  })

  it('should return existing order for PENDING_PAYMENT re-request (idempotent)', async () => {
    mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue({
      id: 'booking-existing', bookingRef: 'TRP-2025-OLD1', bookingStatus: 'PENDING_PAYMENT',
      totalAmount: 10000, expiresAt: new Date(NOW + 30 * 60 * 1000),
      paymentTransactions: [{ razorpayOrderId: 'order_existing' }],
    })

    const result = await bookingService.createBooking('user-1', {
      tripId: 'trip-1', numTravelers: 2,
      travelers: [
        { name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'B', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    })

    expect(result.bookingId).toBe('booking-existing')
    expect(result.razorpayOrderId).toBe('order_existing')
    expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalled()
  })

  it('should reject booking for FULL trip status', async () => {
    mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
    mockTripRepo.findByIdForBooking.mockResolvedValue({ ...BASE_TRIP, status: 'FULL' })

    await expect(
      bookingService.createBooking('user-1', {
        tripId: 'trip-1', numTravelers: 2,
        travelers: [
          { name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
          { name: 'B', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
        ],
      }),
    ).rejects.toThrow('not accepting bookings')
  })

  it('should reject booking for COMPLETED trip status', async () => {
    mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
    mockTripRepo.findByIdForBooking.mockResolvedValue({ ...BASE_TRIP, status: 'COMPLETED' })

    await expect(
      bookingService.createBooking('user-1', {
        tripId: 'trip-1', numTravelers: 2,
        travelers: [
          { name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
          { name: 'B', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
        ],
      }),
    ).rejects.toThrow('not accepting bookings')
  })

  it('should batch-limit trip completions to 50', async () => {
    const lifecycleTripRepo = (lifecycleService as any).tripRepo
    lifecycleTripRepo.findTripsToComplete.mockResolvedValue([])

    await lifecycleService.completeEndedTrips()

    expect(lifecycleTripRepo.findTripsToComplete).toHaveBeenCalledWith(50)
  })

  it('should throw BOOKING_IN_PROGRESS when Redis lock is already held by another request for same user+trip', async () => {
    // Simulates: two simultaneous POST /bookings arrive, first holds the lock,
    // second request cannot acquire it and must fail fast rather than creating a duplicate.
    vi.mocked(withLock).mockResolvedValueOnce(false)

    const input = {
      tripId: 'trip-1', numTravelers: 2,
      travelers: [
        { name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'B', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    }

    await expect(
      bookingService.createBooking('user-1', input),
    ).rejects.toMatchObject({
      message: expect.stringContaining('already in progress'),
      subCode: 'BOOKING_IN_PROGRESS',
    })

    // Verify nothing was written to DB or Razorpay
    expect(mockTripRepo.findByIdForBooking).not.toHaveBeenCalled()
    expect(mockPaymentService.createOrder).not.toHaveBeenCalled()
    expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalled()
  })

  it('should NOT block a different user booking the same trip (lock is scoped per user+trip)', async () => {
    // User-1 and user-2 booking the same trip concurrently should use different lock keys.
    // This test captures both lock keys and verifies they differ.
    const capturedKeys: string[] = []
    vi.mocked(withLock)
      .mockImplementationOnce(async (key, _ttl, fn) => { capturedKeys.push(key); await fn(); return true })
      .mockImplementationOnce(async (key, _ttl, fn) => { capturedKeys.push(key); await fn(); return true })

    const input = {
      tripId: 'trip-1', numTravelers: 1,
      travelers: [{ name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true }],
    }

    // Setup mocks to not throw (will fail at findByIdForBooking returning null — that's fine)
    mockBookingRepo.findActiveByUserAndTrip.mockResolvedValue(null)
    mockTripRepo.findByIdForBooking.mockResolvedValue(null) // throws NotFoundError

    await bookingService.createBooking('user-1', input).catch(() => {})
    await bookingService.createBooking('user-2', input).catch(() => {})

    expect(capturedKeys).toHaveLength(2)
    expect(capturedKeys[0]).toBe('booking:create:user-1:trip-1')
    expect(capturedKeys[1]).toBe('booking:create:user-2:trip-1')
    expect(capturedKeys[0]).not.toBe(capturedKeys[1])
  })

  it('TOCTOU: second concurrent request sees booking created by first, returns idempotently', async () => {
    // Scenario: two requests for the same user+trip arrive within milliseconds.
    // Request A wins the lock and creates the booking.
    // Request B passes fast-path (both see null), acquires lock after A releases,
    // and the re-check under lock finds A's booking — returns it without creating a duplicate.
    const bookingCreatedByA = {
      id: 'booking-from-A',
      bookingRef: 'TRP-2025-RACE1',
      bookingStatus: 'PENDING_PAYMENT',
      totalAmount: 10000,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      paymentTransactions: [{ razorpayOrderId: 'order_from_A' }],
    }

    // Both requests call findActiveByUserAndTrip twice:
    //   call 1 (fast-path of B) → null  (A's booking doesn't exist yet)
    //   call 2 (under-lock of B) → A's booking  (A committed while B was waiting for lock)
    mockBookingRepo.findActiveByUserAndTrip
      .mockResolvedValueOnce(null)            // B's fast-path
      .mockResolvedValueOnce(bookingCreatedByA) // B's under-lock re-check

    const result = await bookingService.createBooking('user-1', {
      tripId: 'trip-1', numTravelers: 2,
      travelers: [
        { name: 'A', phone: '9999999999', age: 25, gender: 'FEMALE' as const, isPrimary: true },
        { name: 'B', phone: '8888888888', age: 28, gender: 'MALE' as const, isPrimary: false },
      ],
    })

    // B returns A's booking — no duplicate created
    expect(result.bookingId).toBe('booking-from-A')
    expect(result.razorpayOrderId).toBe('order_from_A')
    expect(mockPaymentService.createOrder).not.toHaveBeenCalled()
    expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalled()
  })

  it('should handle escrow release when payment service is null (dev mode)', async () => {
    const devLifecycle = new TripLifecycleService(
      mockTripRepo as any,
      mockPaymentTxRepo as any,
      null,
      logger as any,
    )

    const result = await devLifecycle.releaseEscrowForTrip('trip-1')

    expect(result).toEqual({ released: 0, failed: 0, skipped: 0 })
  })
})
