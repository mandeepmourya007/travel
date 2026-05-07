/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// Mock env before importing services that depend on it
vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'test_secret',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
  },
}))

import { TripService } from '../../../src/services/trip.service'
import { BookingService } from '../../../src/services/booking.service'
import { logger } from '../../../src/utils/logger'

// ── Mock Repos (TripService) ─────────────────────────

const mockTripRepo = {
  findById: vi.fn(),
  findByIdLite: vi.fn(),
  findByIdForBooking: vi.fn(),
  search: vi.fn(),
  findBySlug: vi.fn(),
  findByOrganizerId: vi.fn(),
  slugExists: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  withTransaction: vi.fn(),
  calculateOrganizerRevenue: vi.fn(),
  countPendingRequests: vi.fn(),
  atomicIncrementBookings: vi.fn(),
  atomicDecrementBookings: vi.fn(),
  markFullIfAtCapacity: vi.fn().mockResolvedValue(0),
  revertFullIfUnderCapacity: vi.fn().mockResolvedValue(0),
}

const mockDestinationRepo = {
  findById: vi.fn(),
  incrementTripCount: vi.fn(),
  decrementTripCount: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findByUserId: vi.fn(),
}

const mockEditHistoryRepo = {
  create: vi.fn(),
  findByTripId: vi.fn(),
}

const mockBookingRepo = {
  findByTripId: vi.fn(),
  getTripBookingSummary: vi.fn(),
  findByUserId: vi.fn(),
  getMyBookingSummary: vi.fn(),
  findById: vi.fn(),
  cancel: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  findActiveByUserAndTrip: vi.fn(),
  findExpiredPendingBookings: vi.fn(),
  findWithPaymentDetails: vi.fn(),
}

const mockTripRequestRepo = {
  findByTripId: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  findAllPendingForOrganizer: vi.fn(),
  create: vi.fn(),
  findApprovedForUser: vi.fn(),
  findPendingPaymentForUser: vi.fn(),
  markConverted: vi.fn(),
  countPendingPaymentForUser: vi.fn(),
  findExpiredOrRejectedForUser: vi.fn(),
  resetToPending: vi.fn(),
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

// ── Test Data Factories ─────────────────────────────

function createMockTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip-1',
    title: 'Goa Beach Getaway',
    slug: 'goa-beach-getaway-dec-2025',
    destinationId: 'dest-1',
    organizerId: 'org-1',
    tripType: 'BEACH',
    bookingMode: 'REQUEST_BASED',
    pricePerPerson: 4500,
    startDate: new Date('2025-12-06'),
    endDate: new Date('2025-12-08'),
    minGroupSize: 10,
    maxGroupSize: 20,
    currentBookings: 12,
    status: 'ACTIVE',
    acceptingBookings: true,
    ...overrides,
  }
}

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    tripId: 'trip-1',
    userId: 'user-10',
    numTravelers: 2,
    message: 'We would love to join!',
    travelerDetails: [
      { name: 'Amit Kumar', phone: '9876543210', age: 28, gender: 'MALE', isPrimary: true },
      { name: 'Sneha Sharma', phone: '9876543211', age: 26, gender: 'FEMALE', isPrimary: false },
    ],
    status: 'APPROVED',
    createdAt: new Date('2025-11-21'),
    respondedAt: new Date('2025-11-22'),
    responseNote: null,
    approvalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    user: { id: 'user-10', name: 'Amit Kumar', email: 'amit@test.com', avatarUrl: null },
    trip: {
      id: 'trip-1',
      title: 'Goa Beach Getaway',
      slug: 'goa-beach-getaway-dec-2025',
      startDate: new Date('2025-12-06'),
      endDate: new Date('2025-12-08'),
      photos: ['photo1.jpg'],
      pricePerPerson: 4500,
      destination: { id: 'dest-1', name: 'Goa', slug: 'goa' },
      organizer: { id: 'org-1', businessName: 'TripVibes', verificationStatus: 'APPROVED' },
    },
    ...overrides,
  }
}

// ── Setup ───────────────────────────────────────────

let tripService: TripService
let bookingService: BookingService

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no stale request exists (tests that need re-apply override this)
  mockTripRequestRepo.findExpiredOrRejectedForUser.mockResolvedValue(null)
  tripService = new TripService(
    mockTripRepo as any,
    mockDestinationRepo as any,
    mockOrganizerProfileRepo as any,
    mockEditHistoryRepo as any,
    mockBookingRepo as any,
    mockTripRequestRepo as any,
    {} as any,
    logger as any,
  )
  bookingService = new BookingService(
    mockBookingRepo as any,
    mockTripRepo as any,
    mockTripRequestRepo as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
  )
})

// ═══════════════════════════════════════════════════
// TripService.createTripRequest
// ═══════════════════════════════════════════════════

describe('TripService.createTripRequest', () => {
  it('should create a trip request for a valid REQUEST_BASED trip', async () => {
    const trip = createMockTrip()
    mockTripRepo.findByIdLite.mockResolvedValue(trip)

    const createdRequest = createMockRequest({ status: 'PENDING', approvalExpiresAt: null })
    mockTripRequestRepo.create.mockResolvedValue(createdRequest)

    const travelers = [
      { name: 'Amit Kumar', phone: '9876543210', age: 28, gender: 'MALE', isPrimary: true },
      { name: 'Sneha Sharma', phone: '9876543211', age: 26, gender: 'FEMALE', isPrimary: false },
    ]

    const result = await tripService.createTripRequest('user-10', 'trip-1', {
      numTravelers: 2,
      message: 'We would love to join!',
      travelers,
    })

    expect(result.id).toBe('req-1')
    expect(result.numTravelers).toBe(2)
    expect(result.status).toBe('PENDING')
    expect(mockTripRequestRepo.create).toHaveBeenCalledWith({
      tripId: 'trip-1',
      userId: 'user-10',
      numTravelers: 2,
      message: 'We would love to join!',
      travelers,
    })
  })

  it('should throw NotFoundError when trip does not exist', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(null)

    await expect(
      tripService.createTripRequest('user-10', 'trip-999', { numTravelers: 2 }),
    ).rejects.toThrow('not found')
  })

  it('should throw ValidationError when trip is not ACTIVE', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip({ status: 'DRAFT' }))

    await expect(
      tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 2 }),
    ).rejects.toThrow('not accepting requests')
  })

  it('should throw ValidationError when trip is INSTANT mode', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip({ bookingMode: 'INSTANT' }))

    await expect(
      tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 2 }),
    ).rejects.toThrow('direct bookings')
  })

  it('should throw ValidationError when trip is not accepting bookings', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip({ acceptingBookings: false }))

    await expect(
      tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 2 }),
    ).rejects.toThrow('no longer accepting')
  })

  it('should throw ValidationError when not enough seats', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip({ currentBookings: 19 }))

    await expect(
      tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 3 }),
    ).rejects.toThrow('Not enough seats')
  })

  it('should throw ConflictError when user already has an active request', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip())
    mockTripRequestRepo.findExpiredOrRejectedForUser.mockResolvedValue(null)
    mockTripRequestRepo.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    )

    await expect(
      tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 2 }),
    ).rejects.toThrow('already have a pending request')
  })

  it('should allow re-application when previous request was EXPIRED', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip())
    mockTripRequestRepo.findExpiredOrRejectedForUser.mockResolvedValue(
      { id: 'req-old', status: 'EXPIRED' },
    )
    mockTripRequestRepo.resetToPending.mockResolvedValue(
      createMockRequest({ id: 'req-old', status: 'PENDING', message: 'Trying again!' }),
    )

    const result = await tripService.createTripRequest('user-10', 'trip-1', {
      numTravelers: 2,
      message: 'Trying again!',
    })

    expect(result.status).toBe('PENDING')
    expect(mockTripRequestRepo.resetToPending).toHaveBeenCalledWith('req-old', expect.objectContaining({
      numTravelers: 2,
      message: 'Trying again!',
    }))
    expect(mockTripRequestRepo.create).not.toHaveBeenCalled()
  })

  it('should allow re-application when previous request was REJECTED', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip())
    mockTripRequestRepo.findExpiredOrRejectedForUser.mockResolvedValue(
      { id: 'req-rejected', status: 'REJECTED' },
    )
    mockTripRequestRepo.resetToPending.mockResolvedValue(
      createMockRequest({ id: 'req-rejected', status: 'PENDING' }),
    )

    const result = await tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 1 })

    expect(result.status).toBe('PENDING')
    expect(mockTripRequestRepo.resetToPending).toHaveBeenCalledWith('req-rejected', expect.objectContaining({
      numTravelers: 1,
    }))
  })

  it('should allow request with exactly the remaining seats', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip({ currentBookings: 18 }))
    mockTripRequestRepo.create.mockResolvedValue(createMockRequest({ numTravelers: 2, status: 'PENDING' }))

    const result = await tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 2 })

    expect(result.numTravelers).toBe(2)
    expect(mockTripRequestRepo.create).toHaveBeenCalled()
  })

  it('should pass undefined message when not provided', async () => {
    mockTripRepo.findByIdLite.mockResolvedValue(createMockTrip())
    mockTripRequestRepo.create.mockResolvedValue(createMockRequest({ message: null, status: 'PENDING' }))

    await tripService.createTripRequest('user-10', 'trip-1', { numTravelers: 1 })

    expect(mockTripRequestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: undefined }),
    )
  })
})

// ═══════════════════════════════════════════════════
// BookingService.getMyPendingPaymentRequests
// ═══════════════════════════════════════════════════

describe('BookingService.getMyPendingPaymentRequests', () => {
  it('should return approved non-expired requests with trip details', async () => {
    const mockRequest = createMockRequest()
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue([mockRequest])

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('req-1')
    expect(result[0].tripId).toBe('trip-1')
    expect(result[0].canPay).toBe(true)
    expect(result[0].trip.title).toBe('Goa Beach Getaway')
    expect(result[0].trip.organizer.verified).toBe(true)
    expect(mockTripRequestRepo.findPendingPaymentForUser).toHaveBeenCalledWith('user-10')
  })

  it('should return empty array when no pending requests', async () => {
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue([])

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result).toEqual([])
  })

  it('should set canPay=true for all returned items', async () => {
    const requests = [
      createMockRequest({ id: 'req-1' }),
      createMockRequest({ id: 'req-2' }),
    ]
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue(requests)

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result).toHaveLength(2)
    expect(result.every((r: { canPay: boolean }) => r.canPay === true)).toBe(true)
  })

  it('should set canPay=false for PENDING requests', async () => {
    const mockRequest = createMockRequest({ status: 'PENDING', approvalExpiresAt: null })
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue([mockRequest])

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result[0].canPay).toBe(false)
    expect(result[0].status).toBe('PENDING')
  })

  it('should include travelerDetails in response', async () => {
    const mockRequest = createMockRequest()
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue([mockRequest])

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result[0].travelerDetails).toEqual(mockRequest.travelerDetails)
  })

  it('should return null travelerDetails when relation is empty', async () => {
    const mockRequest = createMockRequest({ travelerDetails: [] })
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue([mockRequest])

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result[0].travelerDetails).toBeNull()
  })

  it('should map organizer verified=false when verificationStatus is not APPROVED', async () => {
    const request = createMockRequest({
      trip: {
        ...createMockRequest().trip,
        organizer: { id: 'org-1', businessName: 'TripVibes', verificationStatus: 'PENDING' },
      },
    })
    mockTripRequestRepo.findPendingPaymentForUser.mockResolvedValue([request])

    const result = await bookingService.getMyPendingPaymentRequests('user-10')

    expect(result[0].trip.organizer.verified).toBe(false)
  })
})

// ═══════════════════════════════════════════════════
// BookingService.getMyBookingSummary — paymentPending count
// ═══════════════════════════════════════════════════

describe('BookingService.getMyBookingSummary (paymentPending)', () => {
  it('should include paymentPending count in summary', async () => {
    mockBookingRepo.getMyBookingSummary.mockResolvedValue([
      { bookingStatus: 'CONFIRMED', _count: { id: 3 } },
      { bookingStatus: 'COMPLETED', _count: { id: 1 } },
    ])
    mockTripRequestRepo.countPendingPaymentForUser.mockResolvedValue(2)

    const result = await bookingService.getMyBookingSummary('user-10')

    expect(result.paymentPending).toBe(2)
    expect(result.upcoming).toBe(3)
    expect(result.completed).toBe(1)
    expect(result.all).toBe(4)
    expect(mockTripRequestRepo.countPendingPaymentForUser).toHaveBeenCalledWith('user-10')
  })

  it('should return paymentPending=0 when no approved requests', async () => {
    mockBookingRepo.getMyBookingSummary.mockResolvedValue([])
    mockTripRequestRepo.countPendingPaymentForUser.mockResolvedValue(0)

    const result = await bookingService.getMyBookingSummary('user-10')

    expect(result.paymentPending).toBe(0)
    expect(result.all).toBe(0)
  })
})

// ═══════════════════════════════════════════════════
// BookingService.confirmBooking — markConverted (C1 fix)
// ═══════════════════════════════════════════════════

describe('BookingService.confirmBooking — markConverted', () => {
  function createConfirmableBooking(overrides: Record<string, unknown> = {}) {
    return {
      id: 'booking-1',
      userId: 'user-10',
      bookingStatus: 'PENDING_PAYMENT',
      numTravelers: 2,
      totalAmount: 9000,
      trip: {
        id: 'trip-1',
        version: 0,
        maxGroupSize: 20,
        currentBookings: 10,
      },
      paymentTransactions: [
        {
          id: 'ptx-1',
          amount: 9000,
          razorpayPaymentId: 'pay_123',
          razorpayOrderId: 'order_123',
          status: 'INITIATED',
        },
      ],
      tripRequest: null,
      ...overrides,
    }
  }

  it('should mark trip request as CONVERTED after confirming booking', async () => {
    const booking = createConfirmableBooking({
      tripRequest: { id: 'req-1', status: 'APPROVED' },
    })
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
    mockPaymentService.capturePayment.mockResolvedValue({ id: 'pay_123' })
    mockBookingRepo.updateStatus.mockResolvedValue(undefined)
    mockTripRequestRepo.markConverted.mockResolvedValue(undefined)

    await bookingService.confirmBooking('booking-1')

    expect(mockTripRequestRepo.markConverted).toHaveBeenCalledWith('req-1', 'booking-1')
  })

  it('should NOT call markConverted when no trip request is associated', async () => {
    const booking = createConfirmableBooking({ tripRequest: null })
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
    mockPaymentService.capturePayment.mockResolvedValue({ id: 'pay_123' })
    mockBookingRepo.updateStatus.mockResolvedValue(undefined)

    await bookingService.confirmBooking('booking-1')

    expect(mockTripRequestRepo.markConverted).not.toHaveBeenCalled()
  })

  it('should NOT call markConverted when trip request status is not APPROVED', async () => {
    const booking = createConfirmableBooking({
      tripRequest: { id: 'req-1', status: 'CONVERTED' },
    })
    mockBookingRepo.findWithPaymentDetails.mockResolvedValue(booking)
    mockTripRepo.atomicIncrementBookings.mockResolvedValue(1)
    mockPaymentService.capturePayment.mockResolvedValue({ id: 'pay_123' })
    mockBookingRepo.updateStatus.mockResolvedValue(undefined)

    await bookingService.confirmBooking('booking-1')

    expect(mockTripRequestRepo.markConverted).not.toHaveBeenCalled()
  })
})
