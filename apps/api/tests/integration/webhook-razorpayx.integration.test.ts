/**
 * Integration tests for the RazorpayX Payouts webhook route.
 *
 * Modeled directly on tests/integration/webhook-razorpay.integration.test.ts — same
 * real-Postgres + real-Supertest harness, same raw-body serialization workaround, same
 * waitUntil polling helper. No real RazorpayX network call is needed: signature
 * verification is pure local HMAC-SHA256(rawBody, secret), identical scheme to the
 * Razorpay PG webhook, just with a separate secret/namespace (source=RAZORPAYX).
 *
 * Run inside Docker:
 *   docker compose exec api npx vitest run tests/integration/webhook-razorpayx.integration.test.ts
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
import { PAYMENT_PROVIDER } from '@shared/constants'
import type { PaymentProvider } from '../../src/types/payment.types'
import type { IPaymentGateway } from '../../src/providers/payment/payment-gateway.interface'
import { RazorpayGateway } from '../../src/providers/payment/razorpay.gateway'
import { RazorpayXClient } from '../../src/providers/payout/razorpayx.client'
import { PaymentService } from '../../src/services/payment.service'
import { WebhookController } from '../../src/controllers/webhook.controller'
import { WebhookEventRepository } from '../../src/repositories/webhook-event.repository'
import { PaymentTransactionRepository } from '../../src/repositories/payment-transaction.repository'
import { BookingRepository } from '../../src/repositories/booking.repository'
import { webhookRateLimit } from '../../src/middleware/rate-limit.middleware'
import { logger } from '../../src/utils/logger'
import { PAYMENT_TX_STATUS, PAYMENT_TX_TYPE, WEBHOOK_SOURCE } from '../../src/utils/constants'
import type { BookingService } from '../../src/services/booking.service'
import { getIntegrationDbUrl } from '../helpers/test-db'

// @prisma/client re-loads .env on import, undoing tests/setup.ts's
// `delete process.env.REDIS_URL` — so without this mock webhookRateLimit would issue
// commands against an unreachable Redis (same rationale as the sibling Razorpay suite).
vi.mock('../../src/config/redis', () => ({ redis: null }))

const DB_URL = getIntegrationDbUrl()

const TEST_WEBHOOK_SECRET = 'test_razorpayx_webhook_secret_it'

// ── Shared state ───────────────────────────────────────────────────────────

let prisma: PrismaClient
let app: Express
let canConnect = false

let testUserId: string
let testOrganizerId: string
let testDestinationId: string

let testTripIds: string[] = []
let testBookingIds: string[] = []

// ── Helpers ────────────────────────────────────────────────────────────────

async function createTrip() {
  const trip = await prisma.trip.create({
    data: {
      organizerId: testOrganizerId,
      destinationId: testDestinationId,
      title: 'RazorpayX Webhook Integration Test Trip',
      slug: `razorpayx-webhook-it-trip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

async function seedPayoutReleaseTx(tripId: string, payoutId: string) {
  const booking = await prisma.booking.create({
    data: {
      bookingRef: `RZXWH-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tripId,
      userId: testUserId,
      numTravelers: 1,
      totalAmount: 5000,
      bookingStatus: 'CONFIRMED',
    },
  })
  testBookingIds.push(booking.id)

  const tx = await prisma.paymentTransaction.create({
    data: {
      bookingId: booking.id,
      type: PAYMENT_TX_TYPE.PAYOUT_RELEASE,
      amount: 4500,
      provider: PAYMENT_PROVIDER.RAZORPAY,
      gatewayTransferId: payoutId,
      status: PAYMENT_TX_STATUS.PROCESSING,
    },
  })

  return { booking, tx }
}

function buildRawBody(event: string, payoutId: string, extra: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({
    event,
    account_id: 'acc_test_it',
    payload: {
      payout: { entity: { id: payoutId, status: 'processing', ...extra } },
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
    console.warn(`⚠ Skipping RazorpayX webhook integration tests — cannot connect to DB at ${DB_URL.replace(/:[^@]+@/, ':***@')}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      name: 'RazorpayX Webhook Test Organizer User',
      email: `razorpayx-webhook-it-organizer-${Date.now()}@test.com`,
      role: 'ORGANIZER',
    },
  })
  testUserId = user.id

  const org = await prisma.organizerProfile.create({
    data: {
      userId: user.id,
      businessName: 'RazorpayX Webhook Test Org',
      slug: `razorpayx-webhook-it-org-${Date.now()}`,
      razorpayxFundAccountId: 'fa_it_test',
    },
  })
  testOrganizerId = org.id

  const destination = await prisma.destination.create({
    data: {
      name: 'RazorpayX Webhook Test Destination',
      slug: `razorpayx-webhook-it-dest-${Date.now()}`,
      state: 'Maharashtra',
    },
  })
  testDestinationId = destination.id

  // ── Real DI graph, backed by the real test-DB PrismaClient ──
  /* eslint-disable @typescript-eslint/no-explicit-any -- narrow test doubles for wide service deps */
  const paymentTxRepo = new PaymentTransactionRepository(prisma as any)
  const webhookEventRepo = new WebhookEventRepository(prisma as any)
  const bookingRepo = new BookingRepository(prisma as any)

  // Active PG gateway is irrelevant to this suite (only the RazorpayX payout webhook
  // path is exercised), but PaymentService requires one — reuse a minimal fake, same
  // as the sibling suite's fakeRazorpaySdk.
  const fakeRazorpaySdk = { payments: { capture: vi.fn() } }
  const razorpayGateway = new RazorpayGateway(
    fakeRazorpaySdk as any,
    'test_key_secret_it',
    'unused_pg_webhook_secret_it',
    'test_key_id_it',
    logger as any,
  )
  const gateways = new Map<PaymentProvider, IPaymentGateway>([
    [PAYMENT_PROVIDER.RAZORPAY, razorpayGateway],
  ])

  // Real RazorpayXClient — verifyAndParseWebhook is pure local HMAC, no network call.
  const razorpayxClient = new RazorpayXClient(
    { key_id: 'rzpx_test_key', key_secret: 'rzpx_test_secret' } as any,
    'rzpx_account_it',
    TEST_WEBHOOK_SECRET,
    logger as any,
  )

  const paymentService = new PaymentService(razorpayGateway, gateways, paymentTxRepo, webhookEventRepo, logger as any, razorpayxClient)
  paymentService.setPostConstruct(bookingRepo, { send: vi.fn().mockResolvedValue(undefined) } as any)

  // WebhookController only needs a BookingService reference for the PG webhook path
  // (handleRazorpay/handleCashfree) — handleRazorpayx never touches it.
  const fakeBookingService = {} as BookingService
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const webhookController = new WebhookController(paymentService, fakeBookingService)

  app = express()
  app.post(
    '/razorpayx',
    express.raw({ type: 'application/json' }),
    webhookRateLimit,
    webhookController.handleRazorpayx,
  )
}, 30_000)

afterAll(async () => {
  if (!canConnect) return
  await prisma.paymentTransaction.deleteMany({ where: { bookingId: { in: testBookingIds } } })
  await prisma.webhookEvent.deleteMany({ where: { source: WEBHOOK_SOURCE.RAZORPAYX } })
  await prisma.booking.deleteMany({ where: { tripId: { in: testTripIds } } })
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
  if (testBookingIds.length) {
    await prisma.paymentTransaction.deleteMany({ where: { bookingId: { in: testBookingIds } } })
    await prisma.booking.deleteMany({ where: { id: { in: testBookingIds } } })
  }
  if (testTripIds.length) await prisma.trip.deleteMany({ where: { id: { in: testTripIds } } })
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /razorpayx (webhook integration)', () => {
  it('a valid payout.processed webhook moves the seeded PAYOUT_RELEASE transaction to CAPTURED and records a RAZORPAYX WebhookEvent', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const payoutId = `pout_processed_${Date.now()}`
    const { tx } = await seedPayoutReleaseTx(trip.id, payoutId)

    const rawBody = buildRawBody('payout.processed', payoutId)
    const signature = signBody(rawBody)

    const res = await request(app)
      .post('/razorpayx')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      // Bypass superagent's JSON serializer for Buffer bodies — see sibling suite's
      // identical comment for why this is required to preserve the exact signed bytes.
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    await waitUntil(async () => {
      const updated = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
      return updated?.status === PAYMENT_TX_STATUS.CAPTURED
    }, 10_000)

    const finalTx = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
    expect(finalTx?.status).toBe(PAYMENT_TX_STATUS.CAPTURED)

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { source: WEBHOOK_SOURCE.RAZORPAYX, externalEventId: `rzpx_payout.processed_${payoutId}` },
    })
    expect(webhookEvent).not.toBeNull()
  }, 20_000)

  it('a valid payout.reversed webhook moves the transaction to REVERSED', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const payoutId = `pout_reversed_${Date.now()}`
    const { tx } = await seedPayoutReleaseTx(trip.id, payoutId)

    const rawBody = buildRawBody('payout.reversed', payoutId)
    const signature = signBody(rawBody)

    const res = await request(app)
      .post('/razorpayx')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    await waitUntil(async () => {
      const updated = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
      return updated?.status === PAYMENT_TX_STATUS.REVERSED
    }, 10_000)

    const finalTx = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
    expect(finalTx?.status).toBe(PAYMENT_TX_STATUS.REVERSED)
  }, 20_000)

  it('does not create a WebhookEvent or change transaction status when the signature is missing', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const payoutId = `pout_missing_sig_${Date.now()}`
    const { tx } = await seedPayoutReleaseTx(trip.id, payoutId)

    const rawBody = buildRawBody('payout.processed', payoutId)

    const res = await request(app)
      .post('/razorpayx')
      .set('Content-Type', 'application/json')
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 500))

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { source: WEBHOOK_SOURCE.RAZORPAYX, externalEventId: `rzpx_payout.processed_${payoutId}` },
    })
    expect(webhookEvent).toBeNull()

    const unchangedTx = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
    expect(unchangedTx?.status).toBe(PAYMENT_TX_STATUS.PROCESSING)
  })

  it('does not process the event when the signature is well-formed hex but wrong', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const payoutId = `pout_bad_sig_${Date.now()}`
    const { tx } = await seedPayoutReleaseTx(trip.id, payoutId)

    const rawBody = buildRawBody('payout.processed', payoutId)
    const wrongSignature = crypto.createHmac('sha256', 'not_the_real_secret').update(rawBody).digest('hex')

    const res = await request(app)
      .post('/razorpayx')
      .set('x-razorpay-signature', wrongSignature)
      .set('Content-Type', 'application/json')
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)

    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 500))

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where: { source: WEBHOOK_SOURCE.RAZORPAYX, externalEventId: `rzpx_payout.processed_${payoutId}` },
    })
    expect(webhookEvent).toBeNull()

    const unchangedTx = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
    expect(unchangedTx?.status).toBe(PAYMENT_TX_STATUS.PROCESSING)
  })

  it('processes a replayed identical event exactly once (idempotent on source+externalEventId) — one WebhookEvent row, attempts=2, status updated once', async () => {
    if (!canConnect) return

    const trip = await createTrip()
    const payoutId = `pout_dup_${Date.now()}`
    const { tx } = await seedPayoutReleaseTx(trip.id, payoutId)

    const rawBody = buildRawBody('payout.processed', payoutId)
    const signature = signBody(rawBody)

    const firstRes = await request(app)
      .post('/razorpayx')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)
    expect(firstRes.status).toBe(200)

    await waitUntil(async () => {
      const updated = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
      return updated?.status === PAYMENT_TX_STATUS.CAPTURED
    }, 10_000)

    // Replay the identical payload + signature
    const secondRes = await request(app)
      .post('/razorpayx')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .serialize((body: unknown) => body as unknown as string)
      .send(rawBody)
    expect(secondRes.status).toBe(200)

    // Give the (no-op) async tail of the replay a beat, then assert.
    await new Promise((r) => setTimeout(r, 500))

    const webhookEvents = await prisma.webhookEvent.findMany({
      where: { source: WEBHOOK_SOURCE.RAZORPAYX, externalEventId: `rzpx_payout.processed_${payoutId}` },
    })
    expect(webhookEvents).toHaveLength(1)
    expect(webhookEvents[0].attempts).toBe(2)

    // Status was applied exactly once — still CAPTURED, not double-processed into some
    // other state (e.g. if processing ran twice it would still be CAPTURED here, so the
    // real assertion is on updatedAt not advancing — but per-transaction updatedAt
    // granularity is coarse; the WebhookEvent attempts=2 + processed-once behavior
    // (duplicate short-circuits BEFORE processWebhookEvent is ever called — see
    // PaymentService.handleRazorpayxWebhook's `webhookEvent.attempts > 1` guard) is the
    // authoritative idempotency proof.
    const finalTx = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } })
    expect(finalTx?.status).toBe(PAYMENT_TX_STATUS.CAPTURED)
  }, 20_000)
})
