/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════
// Commission-rate snapshot chain regression test.
//
// See the trip-pricing-inversion plan (§6-9): OrganizerProfile.commissionRate is
// admin-editable at any time, but Trip.commissionRate and Booking.commissionRate are
// FROZEN snapshots taken at trip-creation and booking-creation time respectively.
// Admin changing an organizer's rate must NEVER retroactively affect an already-created
// trip or an already-placed booking.
//
// This test exercises the real TripService, AdminService, and BookingService together
// (mocked repositories, no DB) to prove the full chain end-to-end:
//   1. Organizer's profile has commissionRate = A.
//   2. TripService.createTrip snapshots A onto the new Trip row.
//   3. AdminService.updateOrganizerCommission changes the PROFILE's rate to B.
//   4. BookingService.createBooking, against the SAME trip (still holding A), snapshots
//      A (not B) onto the new Booking row and uses A for the same-request commission split.
// ═══════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TripService } from '../../../src/services/trip.service'
import { AdminService } from '../../../src/services/admin.service'
import { BookingService } from '../../../src/services/booking.service'
import { logger } from '../../../src/utils/logger'

vi.mock('../../../src/utils/redis-lock', () => ({
  withLock: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<void>) => {
    await fn()
    return true
  }),
}))

const mockEnv = {
  PAYMENT_GATEWAY: 'razorpay' as const,
  CASHFREE_ENV: 'sandbox' as const,
  CLIENT_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
}
vi.mock('../../../src/config/env', () => ({
  get env() { return mockEnv },
}))

const RATE_A = 10 // organizer's rate at the time the trip is created
const RATE_B = 30 // rate admin changes it to AFTER trip creation, before booking

describe('Commission-rate snapshot chain (trip-creation -> admin edit -> booking-creation)', () => {
  // In-memory "organizer profile row" — the one piece of state genuinely shared
  // between TripService.createTrip and AdminService.updateOrganizerCommission,
  // exactly like the real OrganizerProfile row in Postgres.
  let profileRow: { id: string; commissionRate: number; [key: string]: unknown }

  const mockOrganizerProfileRepo = {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  }

  const mockDestinationRepo = { findBySlug: vi.fn(), findById: vi.fn() }
  const mockEditHistoryRepo = { create: vi.fn() }
  const mockReviewRepo = {}
  const mockTripRepo = {
    slugExists: vi.fn().mockResolvedValue(false),
    create: vi.fn(),
    findByIdForBooking: vi.fn(),
    atomicIncrementBookings: vi.fn(),
    markFullIfAtCapacity: vi.fn().mockResolvedValue(0),
  }
  const mockBookingRepo = {
    findActiveByUserAndTrip: vi.fn().mockResolvedValue(null),
    createWithPaymentTx: vi.fn(),
  }
  const mockTripRequestRepo = { findApprovedForUser: vi.fn(), countPendingPaymentForUser: vi.fn().mockResolvedValue(0), findPendingPaymentForUser: vi.fn().mockResolvedValue([]) }
  const mockPaymentTxRepo = {}
  const mockPaymentService = {
    createOrder: vi.fn().mockResolvedValue({
      orderId: 'order_1',
      status: 'created',
      clientPayload: { provider: 'razorpay', orderId: 'order_1', razorpayKeyId: 'rzp_test' },
    }),
  }

  let tripService: TripService
  let adminService: AdminService
  let bookingService: BookingService

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.PAYMENT_GATEWAY = 'razorpay'
    mockEnv.CASHFREE_ENV = 'sandbox'

    profileRow = { id: 'org-profile-1', userId: 'organizer-user-1', commissionRate: RATE_A, businessName: 'TripVibes' }
    mockOrganizerProfileRepo.findByUserId.mockImplementation(async () => ({
      ...profileRow,
      verificationStatus: 'APPROVED',
      documents: { aadhaarFront: 'f', aadhaarBack: 'b', panCard: 'p' },
      bankAccountLinked: true,
    }))
    mockOrganizerProfileRepo.findById.mockImplementation(async (id: string) => (id === profileRow.id ? { ...profileRow } : null))
    mockOrganizerProfileRepo.update.mockImplementation(async (id: string, data: { commissionRate?: number }) => {
      if (id === profileRow.id && data.commissionRate != null) profileRow = { ...profileRow, commissionRate: data.commissionRate }
      return { ...profileRow }
    })
    mockDestinationRepo.findBySlug.mockResolvedValue(null)
    mockDestinationRepo.findById.mockResolvedValue({ id: 'dest-1', name: 'Goa', slug: 'goa' })

    tripService = new TripService(
      mockTripRepo as any,
      mockDestinationRepo as any,
      mockOrganizerProfileRepo as any,
      mockEditHistoryRepo as any,
      {} as any,
      {} as any,
      mockReviewRepo as any,
      logger as any,
      { send: vi.fn().mockResolvedValue([]) } as any,
    )

    adminService = new AdminService(
      mockOrganizerProfileRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      logger as any,
      { send: vi.fn().mockResolvedValue([]) } as any,
      {} as any,
      {} as any,
    )

    bookingService = new BookingService(
      mockBookingRepo as any,
      mockTripRepo as any,
      mockTripRequestRepo as any,
      mockPaymentTxRepo as any,
      mockPaymentService as any,
      logger as any,
      { send: vi.fn().mockResolvedValue([]) } as any,
    )
  })

  afterEach(() => {
    mockEnv.PAYMENT_GATEWAY = 'razorpay'
    mockEnv.CASHFREE_ENV = 'sandbox'
  })

  it('freezes the trip at the organizer\'s rate-at-creation-time and keeps using it after admin changes the rate', async () => {
    // 1+2. Create a trip while the organizer's live rate is A (10%).
    const createTripInput = {
      title: 'Goa Beach Getaway',
      destinationId: 'dest-1',
      tripType: 'BEACH',
      bookingMode: 'INSTANT',
      description: 'An amazing beach trip to Goa with water sports and parties.',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
      pricePerPerson: 5000,
      minGroupSize: 5,
      maxGroupSize: 20,
      cancellationPolicy: 'FLEXIBLE',
      inclusions: ['transport'],
      exclusions: ['insurance'],
      itinerary: [],
      photos: [],
      pickupPoints: [{ label: 'Pune Station', time: '06:00 AM' }],
      dropPoints: [{ label: 'Pune Station', time: '08:00 PM' }],
    }

    mockTripRepo.create.mockImplementation(async (data: { commissionRate: number }) => ({
      id: 'trip-1',
      title: 'Goa Beach Getaway',
      slug: 'goa-beach-getaway',
      status: 'ACTIVE',
      pricePerPerson: 5000,
      commissionRate: data.commissionRate,
      destination: { id: 'dest-1', name: 'Goa', slug: 'goa' },
      transferPoints: [],
    }))

    await tripService.createTrip('organizer-user-1', createTripInput as any)

    expect(mockTripRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ commissionRate: RATE_A }),
    )
    const createdTrip = await mockTripRepo.create.mock.results[0].value

    // 3. Admin changes the organizer's PROFILE rate to B (30%) — AFTER the trip exists.
    await adminService.updateOrganizerCommission(profileRow.id, { commissionRate: RATE_B })
    expect(profileRow.commissionRate).toBe(RATE_B)

    // 4. Book the SAME trip. findByIdForBooking must still return the trip's own frozen
    // rate A (schema-level, unaffected by step 3 — the trip row was never touched).
    const tripForBooking = {
      id: 'trip-1',
      title: 'Goa Beach Getaway',
      status: 'ACTIVE',
      bookingMode: 'INSTANT',
      acceptingBookings: true,
      pricePerPerson: 5000,
      earlyBirdPrice: null,
      earlyBirdDeadline: null,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000),
      bookingDeadline: null,
      maxGroupSize: 20,
      currentBookings: 0,
      version: 0,
      isDeleted: false,
      isHidden: false,
      bookingsPausedReason: null,
      // The trip's own frozen commissionRate — set once at creation (RATE_A), completely
      // independent of profileRow.commissionRate, which is now RATE_B.
      commissionRate: createdTrip.commissionRate,
      organizer: { id: profileRow.id, userId: 'organizer-user-1', razorpayAccountId: null, cashfreeVendorId: null },
      transferPoints: [],
    }
    mockTripRepo.findByIdForBooking.mockResolvedValue(tripForBooking)
    mockBookingRepo.createWithPaymentTx.mockResolvedValue({
      id: 'booking-1', bookingRef: 'TRP-2026-0001', totalAmount: 10000, expiresAt: new Date(),
    })

    await bookingService.createBooking('traveler-1', {
      tripId: 'trip-1',
      numTravelers: 2,
      travelers: [
        { name: 'Alice', phone: '9999999999', age: 25, gender: 'FEMALE', isPrimary: true },
        { name: 'Bob', phone: '8888888888', age: 28, gender: 'MALE', isPrimary: false },
      ],
    } as any)

    // The booking must snapshot RATE_A (the trip's frozen rate), never RATE_B (the
    // organizer's live rate the admin just changed it to).
    expect(mockBookingRepo.createWithPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({ commissionRate: RATE_A }),
      expect.any(Object),
      undefined,
      undefined,
    )
    expect(mockBookingRepo.createWithPaymentTx).not.toHaveBeenCalledWith(
      expect.objectContaining({ commissionRate: RATE_B }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })
})
