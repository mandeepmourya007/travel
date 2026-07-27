/**
 * Integration tests for the Razorpay webhook route.
 *
 * Runs against a real PostgreSQL database and a real Express route (via
 * Supertest) — no mocks for the HTTP layer, signature verification, or DB
 * writes. Only the external Razorpay SDK client is faked (payments.capture),
 * since it would otherwise make a real network call.
 *
 * Run inside Docker:
 *   docker compose exec api npx vitest run tests/integration/webhook-razorpay.integration.test.ts
 *
 * Run locally (requires travel_dev running):
 *   INTEGRATION_DB_URL=postgresql://travel_user:travel_pass@localhost:5432/travel_dev npx vitest run ...
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import express from 'express'
import type { Express } from 'express'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { PAYMENT_PROVIDER, BOOKING_STATUS } from '@shared/constants'
import type { PaymentProvider } from '../../src/types/payment.types'
import type { IPaymentGateway } from '../../src/providers/payment/payment-gateway.interface'
import { RazorpayGateway } from '../../src/providers/payment/razorpay.gateway'
import { PaymentService } from '../../src/services/payment.service'
import { BookingService } from '../../src/services/booking.service'
import { WebhookController } from '../../src/controllers/webhook.controller'
import { WebhookEventRepository } from '../../src/repositories/webhook-event.repository'
import { PaymentTransactionRepository } from '../../src/repositories/payment-transaction.repository'
import { BookingRepository } from '../../src/repositories/booking.repository'
import { TripRepository } from '../../src/repositories/trip.repository'
import { TripRequestRepository } from '../../src/repositories/trip-request.repository'
import { webhookRateLimit } from '../../src/middleware/rate-limit.middleware'
import { logger } from '../../src/utils/logger'
import { PAYMENT_TX_STATUS, WEBHOOK_SOURCE } from '../../src/utils/constants'
import type { NotificationService } from '../../src/services/notification.service'

// @prisma/client re-loads .env on import, undoing tests/setup.ts's
// `delete process.env.REDIS_URL` — so without this mock webhookRateLimit would
// issue commands against an unreachable Redis (same rationale as
// chat-socket.integration.test.ts). Rate limiting itself is not what this
// suite verifies.
vi.mock('../../src/config/redis', () => ({ redis: null }))

const DB_URL =
  process.env.INTEGRATION_DB_URL ??
  process.env.DIRECT_URL ??
  'postgresql://travel_user:travel_pass@localhost:5432/travel_dev?schema=public'

const TEST_WEBHOOK_SECRET = 'test_webhook_secret_it'

// ── Shared state ───────────────────────────────────────────────────────────

let prisma: PrismaClient
let app: Express
let canConnect = false

let testUserId: string
let testOrganizerId: string
let testDestinationId: string

let testTripIds: string[] = []
let testBookingIds: string[] = []
let testEphemeralUserIds: string[] = []

// ── Helpers ────────────────────────────────────────────────────────────────

async function createTrip() {
  const trip = await prisma.trip.create({
    data: {
      organizerId: testOrganizerId,
      destinationId: testDestinationId,
      title: 'Webhook Integration Test Trip',
      slug: `webhook-it-trip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
      status: 'ACTIVE',
    },
  })
  testTripIds.push(trip.id)
  return trip
}

async function createPendingBooking(tripId: string, orderId: string) {
  const user = await prisma.user.create({
    data: { name: 'Webhook Booking User', email: `webhook-booking-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com` },
  })
  testEphemeralUserIds.push(user.id)

  const booking = await prisma.booking.create({
    data: {
      bookingRef: `WHTEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tripId,
      userId: user.id,
      numTravelers: 1,
      totalAmount: 5000,
      bookingStatus: BOOKING_STATUS.PENDING_PAYMENT,
    },
  })
  testBookingIds.push(booking.id)

  // Seed the PaymentTransaction with the order ID as the join key. Do NOT set
  // gatewayPaymentId — that is a side effect of webhook processing and
  // pre-setting it would mask a real ordering bug if it ever broke.
  await prisma.paymentTransaction.create({
    data: {
      bookingId: booking.id,
      type: 'PAYMENT',
      amount: 5000,
      provider: PAYMENT_PROVIDER.RAZORPAY,
      gatewayOrderId: orderId,
      status: PAYMENT_TX_STATUS.INITIATED,
    },
  })

  return booking
}

function buildRawBody(event: string, orderId: string, paymentId: string) {
  return Buffer.from(JSON.stringify({
    event,
    account_id: 'acc_test_it',
    payload: {
      payment: {
        entity: { id: paymentId, order_id: orderId, status: 'captured', error_description: null, error_code: null },
      },
      order: { entity: { id: orderId, status: 'paid' } },
    },
  }))
}

function signBody(rawBody: Buffer) {
  return crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawBody).digest('hex')
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 50): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('waitUntil: condition not met before timeout')
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: DB_URL })

  try {
    await prisma.$connect()
    canConnect = true
  } catch {
    console.warn(`⚠ Skipping Razorpay webhook integration tests — cannot connect to DB at ${DB_URL.replace(/:[^@]+@/, ':***@')}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      name: 'Webhook Test Organizer User',
      email: `webhook-it-organizer-${Date.now()}@test.com`,
      role: 'ORGANIZER',
    },
  })
  testUserId = user.id

  const org = await prisma.organizerProfile.create({
    data: {
      userId: user.id,
      businessName: 'Webhook Test Org',
      slug: `webhook-it-org-${Date.now()}`,
    },
  })
  testOrganizerId = org.id

  const destination = await prisma.destination.create({
    data: {
      name: 'Webhook Test Destination',
      slug: `webhook-it-dest-${Date.now()}`,
      state: 'Maharashtra',
    },
  })
  testDestinationId = destination.id

  // ── Real DI graph, backed by the real test-DB PrismaClient ──
  /* eslint-disable @typescript-eslint/no-explicit-any -- narrow test doubles for wide service deps */
  const bookingRepo = new BookingRepository(prisma as any)
  const tripRepo = new TripRepository(prisma as any)
  const tripRequestRepo = new TripRequestRepository(prisma as any)
  const paymentTxRepo = new PaymentTransactionRepository(prisma as any)
  const webhookEventRepo = new WebhookEventRepository(prisma as any)

  // Fake Razorpay SDK client — only capturePayment is exercised downstream via
  // BookingService.confirmBooking(); signature verification is pure local HMAC.
  const fakeRazorpaySdk = {
    payments: {
      capture: vi.fn().mockResolvedValue({ id: 'pay_x', status: 'captured' }),
    },
  }

  const razorpayGateway = new RazorpayGateway(
    fakeRazorpaySdk as any,
    'test_key_secret_it',
    TEST_WEBHOOK_SECRET,
    'test_key_id_it',
    logger as any,
  )

  const gateways = new Map<PaymentProvider, IPaymentGateway>([
    [PAYMENT_PROVIDER.RAZORPAY, razorpayGateway],
  ])

  const paymentService = new PaymentService(razorpayGateway, gateways, paymentTxRepo, webhookEventRepo, logger as any)

  // No-op notification service — booking confirmation fires a notification
  // fire-and-forget; not relevant to webhook correctness.
  const fakeNotificationService = {
    send: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService

  paymentService.setPostConstruct(bookingRepo, fakeNotificationService)

  const bookingService = new BookingService(
    bookingRepo,
    tripRepo,
    tripRequestRepo,
    paymentTxRepo,
    paymentService,
    logger as any,
    fakeNotificationService,
    null,
    null,
    null,
    null,
    null,
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const webhookController = new WebhookController(paymentService, bookingService)

  app = express()
  app.post(
    '/razorpay',
    express.raw({ type: 'application/json' }),
    webhookRateLimit,
    webhookController.handleRazorpay,
  )
}, 30_000)

afterAll(async () => {
  if (!canConnect) return
  await prisma.paymentTransaction.deleteMany({ where: { bookingId: { in: testBookingIds } } })
  await prisma.webhookEvent.deleteMany({ where: { source: WEBHOOK_SOURCE.RAZORPAY } })
  await prisma.booking.deleteMany({ where: { tripId: { in: testTripIds } } })
  await prisma.trip.deleteMany({ where: { organizerId: testOrganizerId } })
  await prisma.destination.deleteMany({ where: { id: testDestinationId } })
  await prisma.organizerProfile.deleteMany({ where: { id: testOrganizerId } })
  await prisma.user.deleteMany({ where: { id: { in: [testUserId, ...testEphemeralUserIds] } } })
  await prisma.$disconnect()
})

beforeEach(() => {
  testTripIds = []
  testBookingIds = []
})

afterEach(async () => {
  if (!canConnect) return
  if (testBookingIds.length) {
    await prisma.paymentTransaction.deleteMany({ where: { bookingId: { in: testBookingIds } } })
    await prisma.booking.deleteMany({ where: { id: { in: testBookingIds } } })
  }
  if (testTripIds.length) await prisma.trip.deleteMany({ where: { id: { in: testTripIds } } })
  if (testEphemeralUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: testEphemeralUserIds } } })
    testEphemeralUserIds = []
  }
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /razorpay (webhook integration)', () => {
  it('confirms the booking and captures payment on a validly-signed order.paid event', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const orderId = `order_valid_${Date.now()}`
    const paymentId = `pay_valid_${Date.now()}`
    const booking = await createPendingBooking(trip.id, orderId)

    const rawBody = buildRawBody('order.paid', orderId, paymentId)
    const signature = signBody(rawBody)

    const res = await request(app)
      .post('/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      // superagent's default JSON serializer runs on any non-string body
      // whose Content-Type is application/json — including a Buffer — which
      // would JSON.stringify() our raw bytes into {"type":"Buffer","data":[...]}
      // and invalidate the pre-computed HMAC. Bypass it so the exact bytes
      // that were signed are the exact bytes written to the socket.
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    await waitUntil(async () => {
      const updated = await prisma.booking.findUnique({ where: { id: booking.id } })
      return updated?.bookingStatus === BOOKING_STATUS.CONFIRMED
    }, 10_000)

    const finalBooking = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(finalBooking?.bookingStatus).toBe(BOOKING_STATUS.CONFIRMED)

    const paymentTx = await prisma.paymentTransaction.findFirst({ where: { bookingId: booking.id } })
    expect(paymentTx?.status).toBe(PAYMENT_TX_STATUS.CAPTURED)
    expect(paymentTx?.gatewayPaymentId).toBe(paymentId)

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { source: WEBHOOK_SOURCE.RAZORPAY, externalEventId: `rzp_order.paid_${orderId}` },
    })
    expect(webhookEvent).not.toBeNull()
  }, 20_000)

  it('does not process the event when the x-razorpay-signature header is missing', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const orderId = `order_missing_sig_${Date.now()}`
    const paymentId = `pay_missing_sig_${Date.now()}`
    const booking = await createPendingBooking(trip.id, orderId)

    const rawBody = buildRawBody('order.paid', orderId, paymentId)

    const res = await request(app)
      .post('/razorpay')
      .set('Content-Type', 'application/json')
      // superagent's default JSON serializer runs on any non-string body
      // whose Content-Type is application/json — including a Buffer — which
      // would JSON.stringify() our raw bytes into {"type":"Buffer","data":[...]}
      // and invalidate the pre-computed HMAC. Bypass it so the exact bytes
      // that were signed are the exact bytes written to the socket.
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    // Bounded wait — nothing should ever happen, so just give the async tail
    // a beat then assert no side effects occurred.
    await new Promise((r) => setTimeout(r, 500))

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { source: WEBHOOK_SOURCE.RAZORPAY, externalEventId: `rzp_order.paid_${orderId}` },
    })
    expect(webhookEvent).toBeNull()

    const unchangedBooking = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(unchangedBooking?.bookingStatus).toBe(BOOKING_STATUS.PENDING_PAYMENT)

    const unchangedTx = await prisma.paymentTransaction.findFirst({ where: { bookingId: booking.id } })
    expect(unchangedTx?.status).toBe(PAYMENT_TX_STATUS.INITIATED)
    expect(unchangedTx?.gatewayPaymentId).toBeNull()
  })

  it('does not process the event when the signature is well-formed hex but wrong', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const orderId = `order_bad_sig_${Date.now()}`
    const paymentId = `pay_bad_sig_${Date.now()}`
    const booking = await createPendingBooking(trip.id, orderId)

    const rawBody = buildRawBody('order.paid', orderId, paymentId)
    const wrongSignature = crypto.createHmac('sha256', 'not_the_real_secret').update(rawBody).digest('hex')

    const res = await request(app)
      .post('/razorpay')
      .set('x-razorpay-signature', wrongSignature)
      .set('Content-Type', 'application/json')
      // superagent's default JSON serializer runs on any non-string body
      // whose Content-Type is application/json — including a Buffer — which
      // would JSON.stringify() our raw bytes into {"type":"Buffer","data":[...]}
      // and invalidate the pre-computed HMAC. Bypass it so the exact bytes
      // that were signed are the exact bytes written to the socket.
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 500))

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { source: WEBHOOK_SOURCE.RAZORPAY, externalEventId: `rzp_order.paid_${orderId}` },
    })
    expect(webhookEvent).toBeNull()

    const unchangedBooking = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(unchangedBooking?.bookingStatus).toBe(BOOKING_STATUS.PENDING_PAYMENT)

    const unchangedTx = await prisma.paymentTransaction.findFirst({ where: { bookingId: booking.id } })
    expect(unchangedTx?.status).toBe(PAYMENT_TX_STATUS.INITIATED)
  })

  it('processes a replayed identical event exactly once (idempotent on source+externalEventId)', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const orderId = `order_dup_${Date.now()}`
    const paymentId = `pay_dup_${Date.now()}`
    const booking = await createPendingBooking(trip.id, orderId)

    const rawBody = buildRawBody('order.paid', orderId, paymentId)
    const signature = signBody(rawBody)

    const firstRes = await request(app)
      .post('/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      // superagent's default JSON serializer runs on any non-string body
      // whose Content-Type is application/json — including a Buffer — which
      // would JSON.stringify() our raw bytes into {"type":"Buffer","data":[...]}
      // and invalidate the pre-computed HMAC. Bypass it so the exact bytes
      // that were signed are the exact bytes written to the socket.
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)
    expect(firstRes.status).toBe(200)

    await waitUntil(async () => {
      const updated = await prisma.booking.findUnique({ where: { id: booking.id } })
      return updated?.bookingStatus === BOOKING_STATUS.CONFIRMED
    }, 10_000)

    const tripAfterFirst = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(tripAfterFirst?.currentBookings).toBe(1)

    // Replay the identical payload + signature
    const secondRes = await request(app)
      .post('/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      // superagent's default JSON serializer runs on any non-string body
      // whose Content-Type is application/json — including a Buffer — which
      // would JSON.stringify() our raw bytes into {"type":"Buffer","data":[...]}
      // and invalidate the pre-computed HMAC. Bypass it so the exact bytes
      // that were signed are the exact bytes written to the socket.
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)
    expect(secondRes.status).toBe(200)

    // Give the (no-op) async tail of the replay a beat, then assert.
    await new Promise((r) => setTimeout(r, 500))

    const webhookEvents = await prisma.webhookEvent.findMany({
      where: { source: WEBHOOK_SOURCE.RAZORPAY, externalEventId: `rzp_order.paid_${orderId}` },
    })
    expect(webhookEvents).toHaveLength(1)
    expect(webhookEvents[0].attempts).toBe(2)

    const finalBooking = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(finalBooking?.bookingStatus).toBe(BOOKING_STATUS.CONFIRMED)

    const tripAfterReplay = await prisma.trip.findUnique({ where: { id: trip.id } })
    expect(tripAfterReplay?.currentBookings).toBe(1)
  }, 20_000)
})
