/**
 * Integration tests for the trending score pipeline.
 *
 * Runs against a real PostgreSQL database — no mocks for DB/SQL layer.
 * Catches type-cast bugs, column name errors, and SQL operator mismatches
 * that mock-based unit tests silently pass.
 *
 * Run inside Docker:
 *   docker compose exec api npx vitest run tests/integration/trending-score.integration.test.ts
 *
 * Run locally (requires travel_dev running):
 *   INTEGRATION_DB_URL=postgresql://travel_user:travel_pass@localhost:5432/travel_dev npx vitest run ...
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { BookingRepository } from '../../src/repositories/booking.repository'
import { TripRepository } from '../../src/repositories/trip.repository'
import { BookingVelocityStrategy } from '../../src/services/trending/booking-velocity.strategy'
import { TrendingScoreService } from '../../src/services/trending/trending-score.service'
import { logger } from '../../src/utils/logger'
import { TRENDING_SCORE_THRESHOLD } from '../../src/utils/constants'

const DB_URL =
  process.env.INTEGRATION_DB_URL ??
  process.env.DIRECT_URL ??
  'postgresql://travel_user:travel_pass@localhost:5432/travel_dev?schema=public'

// ── Shared state ───────────────────────────────────────────────────────────

let prisma: PrismaClient
let bookingRepo: BookingRepository
let tripRepo: TripRepository
let canConnect = false

// Stable parent records created once (FK deps for every test)
let testUserId: string
let testOrganizerId: string
let testDestinationId: string

// Per-test trip/booking/user IDs — reset in afterEach
let testTripIds: string[] = []
let testBookingIds: string[] = []
let testEphemeralUserIds: string[] = []

// ── Helpers ────────────────────────────────────────────────────────────────

async function createTrip(overrides: { slug?: string; status?: string } = {}) {
  const trip = await prisma.trip.create({
    data: {
      organizerId: testOrganizerId,
      destinationId: testDestinationId,
      title: 'Integration Test Trip',
      slug: overrides.slug ?? `integ-trip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tripType: 'ADVENTURE',
      description: 'Test',
      itinerary: [],
      inclusions: [],
      exclusions: [],
      startDate: new Date('2099-01-01'),
      endDate: new Date('2099-01-05'),
      pricePerPerson: 5000,
      minGroupSize: 2,
      maxGroupSize: 20,
      photos: [],
      status: (overrides.status ?? 'ACTIVE') as any,
    },
  })
  testTripIds.push(trip.id)
  return trip
}

async function createConfirmedBooking(tripId: string, daysAgo = 2, status: string = 'CONFIRMED') {
  // Each booking needs a distinct user — the schema has a unique constraint on (userId, tripId)
  const user = await prisma.user.create({
    data: { name: 'Booking User', email: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com` },
  })
  testEphemeralUserIds.push(user.id)

  const createdAt = new Date(Date.now() - daysAgo * 86_400_000)
  const booking = await prisma.booking.create({
    data: {
      bookingRef: `TEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tripId,
      userId: user.id,
      numTravelers: 1,
      totalAmount: 5000,
      bookingStatus: status as any,
    },
  })
  // Override createdAt via raw SQL — Prisma @default(now()) can't be overridden in create()
  await prisma.$executeRaw`UPDATE "Booking" SET "createdAt" = ${createdAt} WHERE id = ${booking.id}`
  testBookingIds.push(booking.id)
  return booking
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: DB_URL })
  bookingRepo = new BookingRepository(prisma as any)
  tripRepo = new TripRepository(prisma as any)

  try {
    await prisma.$connect()
    canConnect = true
  } catch {
    console.warn(`⚠ Skipping trending integration tests — cannot connect to DB at ${DB_URL.replace(/:[^@]+@/, ':***@')}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      name: 'Trending Test User',
      email: `trending-integ-${Date.now()}@test.com`,
      role: 'ORGANIZER',
    },
  })
  testUserId = user.id

  const org = await prisma.organizerProfile.create({
    data: {
      userId: user.id,
      businessName: 'Trending Test Org',
      slug: `trending-org-${Date.now()}`,
    },
  })
  testOrganizerId = org.id

  const destination = await prisma.destination.create({
    data: {
      name: 'Trending Test Destination',
      slug: `trending-dest-${Date.now()}`,
      state: 'Maharashtra',
    },
  })
  testDestinationId = destination.id
})

afterAll(async () => {
  if (!canConnect) return
  // Delete in FK-safe order
  await prisma.booking.deleteMany({ where: { userId: testUserId } })
  await prisma.trip.deleteMany({ where: { organizerId: testOrganizerId } })
  await prisma.destination.deleteMany({ where: { id: testDestinationId } })
  await prisma.organizerProfile.deleteMany({ where: { id: testOrganizerId } })
  await prisma.user.deleteMany({ where: { id: testUserId } })
  await prisma.$disconnect()
})

beforeEach(() => {
  testTripIds = []
  testBookingIds = []
})

afterEach(async () => {
  if (!canConnect) return
  if (testBookingIds.length) await prisma.booking.deleteMany({ where: { id: { in: testBookingIds } } })
  if (testTripIds.length) await prisma.trip.deleteMany({ where: { id: { in: testTripIds } } })
  if (testEphemeralUserIds.length) await prisma.user.deleteMany({ where: { id: { in: testEphemeralUserIds } } })
  testEphemeralUserIds = []
})

// ── BookingRepository.aggregateBookingVelocity ────────────────────────────

describe('BookingRepository.aggregateBookingVelocity (integration)', () => {
  it('returns correct week_bookings for recent confirmed bookings', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 1)  // 1 day ago — week bucket
    await createConfirmedBooking(trip.id, 3)  // 3 days ago — week bucket

    const rows = await bookingRepo.aggregateBookingVelocity([trip.id])

    expect(rows).toHaveLength(1)
    expect(rows[0].tripId).toBe(trip.id)
    expect(Number(rows[0].weekBookings)).toBe(2)
    expect(Number(rows[0].monthBookings)).toBe(0)
  })

  it('returns correct month_bookings for bookings in the 8–30 day bucket', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 10)  // 10 days ago — month bucket
    await createConfirmedBooking(trip.id, 25)  // 25 days ago — month bucket

    const rows = await bookingRepo.aggregateBookingVelocity([trip.id])

    expect(rows).toHaveLength(1)
    expect(Number(rows[0].weekBookings)).toBe(0)
    expect(Number(rows[0].monthBookings)).toBe(2)
  })

  it('buckets do not overlap — booking at day 5 counts only in week, not month', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 5)   // week bucket
    await createConfirmedBooking(trip.id, 12)  // month bucket

    const rows = await bookingRepo.aggregateBookingVelocity([trip.id])

    expect(Number(rows[0].weekBookings)).toBe(1)
    expect(Number(rows[0].monthBookings)).toBe(1)
  })

  it('excludes PENDING_PAYMENT bookings from counts', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 1)
    // PENDING_PAYMENT booking via helper with status override
    const pending = await createConfirmedBooking(trip.id, 1, 'PENDING_PAYMENT')
    // Ensure it is not counted
    void pending

    const rows = await bookingRepo.aggregateBookingVelocity([trip.id])

    expect(Number(rows[0].weekBookings)).toBe(1)
  })

  it('excludes soft-deleted bookings from counts', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 1)
    const deleted = await createConfirmedBooking(trip.id, 1)
    await prisma.booking.update({ where: { id: deleted.id }, data: { isDeleted: true } })

    const rows = await bookingRepo.aggregateBookingVelocity([trip.id])

    expect(Number(rows[0].weekBookings)).toBe(1)
  })

  it('aggregates multiple trips in a single query call', async () => {
    if (!canConnect) return
    const tripA = await createTrip()
    const tripB = await createTrip()
    await createConfirmedBooking(tripA.id, 1)
    await createConfirmedBooking(tripA.id, 2)
    await createConfirmedBooking(tripB.id, 1)

    const rows = await bookingRepo.aggregateBookingVelocity([tripA.id, tripB.id])
    const byId = new Map(rows.map((r) => [r.tripId, r]))

    expect(Number(byId.get(tripA.id)!.weekBookings)).toBe(2)
    expect(Number(byId.get(tripB.id)!.weekBookings)).toBe(1)
  })

  it('returns empty array for trips with no bookings', async () => {
    if (!canConnect) return
    const trip = await createTrip()

    const rows = await bookingRepo.aggregateBookingVelocity([trip.id])

    // Trip with no bookings is absent from the result (GROUP BY omits empty groups)
    expect(rows).toHaveLength(0)
  })

  it('returns empty array when given an empty tripIds input', async () => {
    if (!canConnect) return
    const rows = await bookingRepo.aggregateBookingVelocity([])
    expect(rows).toHaveLength(0)
  })
})

// ── TripRepository.findActiveTripIdsForScoring ────────────────────────────

describe('TripRepository.findActiveTripIdsForScoring (integration)', () => {
  it('returns ACTIVE trips', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'ACTIVE' })

    const result = await tripRepo.findActiveTripIdsForScoring()
    const ids = result.map((r) => r.tripId)

    expect(ids).toContain(trip.id)
  })

  it('returns FULL trips', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'FULL' })

    const result = await tripRepo.findActiveTripIdsForScoring()
    const ids = result.map((r) => r.tripId)

    expect(ids).toContain(trip.id)
  })

  it('excludes DRAFT trips', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'DRAFT' })

    const result = await tripRepo.findActiveTripIdsForScoring()
    const ids = result.map((r) => r.tripId)

    expect(ids).not.toContain(trip.id)
  })

  it('excludes soft-deleted trips', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'ACTIVE' })
    await prisma.trip.update({ where: { id: trip.id }, data: { isDeleted: true } })

    const result = await tripRepo.findActiveTripIdsForScoring()
    const ids = result.map((r) => r.tripId)

    expect(ids).not.toContain(trip.id)
  })

  it('returns the startDate alongside the tripId', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'ACTIVE' })

    const result = await tripRepo.findActiveTripIdsForScoring()
    const entry = result.find((r) => r.tripId === trip.id)

    expect(entry).toBeDefined()
    expect(entry!.startDate).toBeInstanceOf(Date)
  })
})

// ── TripRepository.batchUpdateTrendingScores ──────────────────────────────

describe('TripRepository.batchUpdateTrendingScores (integration)', () => {
  it('writes the score to the trendingScore column in the DB', async () => {
    if (!canConnect) return
    const trip = await createTrip()

    await tripRepo.batchUpdateTrendingScores([{ tripId: trip.id, score: 42 }])

    const updated = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(updated!.trendingScore).toBe(42)
  })

  it('updates multiple trips in a single call', async () => {
    if (!canConnect) return
    const tripA = await createTrip()
    const tripB = await createTrip()

    await tripRepo.batchUpdateTrendingScores([
      { tripId: tripA.id, score: 30 },
      { tripId: tripB.id, score: 15 },
    ])

    const [a, b] = await Promise.all([
      prisma.trip.findUnique({ where: { id: tripA.id } }),
      prisma.trip.findUnique({ where: { id: tripB.id } }),
    ])
    expect(a!.trendingScore).toBe(30)
    expect(b!.trendingScore).toBe(15)
  })

  it('does not update soft-deleted trips', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await prisma.trip.update({ where: { id: trip.id }, data: { isDeleted: true, trendingScore: null } })

    await tripRepo.batchUpdateTrendingScores([{ tripId: trip.id, score: 99 }])

    const result = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(result!.trendingScore).toBeNull()
  })

  it('no-ops and does not throw when given an empty array', async () => {
    if (!canConnect) return
    await expect(tripRepo.batchUpdateTrendingScores([])).resolves.toBeUndefined()
  })
})

// ── BookingVelocityStrategy.computeScores ────────────────────────────────

describe('BookingVelocityStrategy.computeScores (integration)', () => {
  it('scores a trip with recent bookings correctly (week × 10)', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 2)  // week bucket → 10 pts

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const [result] = await strategy.computeScores([{ tripId: trip.id, startDate: new Date('2099-01-01') }])

    expect(result.score).toBe(10)
  })

  it('adds urgency bonus for trips starting within 14 days', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 2)  // 10 pts
    const soonDate = new Date(Date.now() + 5 * 86_400_000)  // 5 days away → +5

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const [result] = await strategy.computeScores([{ tripId: trip.id, startDate: soonDate }])

    expect(result.score).toBe(15)  // 10 + 5
  })

  it('returns score 0 for a trip with no bookings', async () => {
    if (!canConnect) return
    const trip = await createTrip()

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const [result] = await strategy.computeScores([{ tripId: trip.id, startDate: new Date('2099-01-01') }])

    expect(result.score).toBe(0)
  })

  it('week and month buckets are independent — no double-counting', async () => {
    if (!canConnect) return
    const trip = await createTrip()
    await createConfirmedBooking(trip.id, 3)   // week  → 1 × 10 = 10
    await createConfirmedBooking(trip.id, 15)  // month → 1 × 2  = 2

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const [result] = await strategy.computeScores([{ tripId: trip.id, startDate: new Date('2099-01-01') }])

    expect(result.score).toBe(12)  // 10 + 2, not 12 + 2 (double-count would give 14)
  })
})

// ── TrendingScoreService.recompute (end-to-end) ───────────────────────────

describe('TrendingScoreService.recompute (integration — full pipeline)', () => {
  it('writes non-zero scores to DB for trips with recent bookings', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'ACTIVE' })
    // 3 confirmed bookings in the last week → score = 30
    await createConfirmedBooking(trip.id, 1)
    await createConfirmedBooking(trip.id, 3)
    await createConfirmedBooking(trip.id, 5)

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const service = new TrendingScoreService(strategy, tripRepo, logger)
    await service.recompute()

    const updated = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(updated!.trendingScore).toBe(30)  // 3 × 10
  })

  it('marks trip as trending when score meets the threshold', async () => {
    if (!canConnect) return
    const trip = await createTrip({ status: 'ACTIVE' })
    // TRENDING_SCORE_THRESHOLD = 20 → need 2+ week bookings
    await createConfirmedBooking(trip.id, 1)
    await createConfirmedBooking(trip.id, 2)

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const service = new TrendingScoreService(strategy, tripRepo, logger)
    await service.recompute()

    const updated = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(updated!.trendingScore).toBeGreaterThanOrEqual(TRENDING_SCORE_THRESHOLD)
  })

  it('writes score 0 to DB for ACTIVE trips with no bookings', async () => {
    if (!canConnect) return
    // Pre-set a non-null score so we can confirm it gets zeroed out
    const trip = await createTrip({ status: 'ACTIVE' })
    await prisma.trip.update({ where: { id: trip.id }, data: { trendingScore: 99 } })

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const service = new TrendingScoreService(strategy, tripRepo, logger)
    await service.recompute()

    const updated = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(updated!.trendingScore).toBe(0)
  })

  it('does NOT update DRAFT trips (not eligible for scoring)', async () => {
    if (!canConnect) return
    const draft = await createTrip({ status: 'DRAFT' })

    const strategy = new BookingVelocityStrategy(bookingRepo, logger)
    const service = new TrendingScoreService(strategy, tripRepo, logger)
    await service.recompute()

    const result = await prisma.trip.findUnique({ where: { id: draft.id } })
    // Score should remain null — draft was never included in scoring input
    expect(result!.trendingScore).toBeNull()
  })
})
