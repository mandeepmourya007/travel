/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { BookingRepository } from '../../../src/repositories/booking.repository'

// ── Mock Prisma ──────────────────────────────────────
// $transaction invokes the callback with a fake `tx` client — mirrors the real
// interactive-transaction shape closely enough to exercise createWithPaymentTx's logic
// without a real Postgres connection (unit-level, per travel-prisma-patterns).
function createMockPrisma() {
  const tx = {
    booking: { create: vi.fn() },
    paymentTransaction: { create: vi.fn() },
    sublinkAttribution: { upsert: vi.fn() },
  }
  const prisma = {
    tx,
    $transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return prisma
}

// ═══════════════════════════════════════════════════════
// createWithPaymentTx (HIGH#2 fix — DEPOSIT_RELEASE row written atomically)
// ═══════════════════════════════════════════════════════
describe('BookingRepository.createWithPaymentTx', () => {
  let repo: BookingRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>

  const bookingData = {
    tripId: 'trip-1',
    userId: 'user-1',
    numTravelers: 2,
    totalAmount: 9000,
    expiresAt: new Date('2025-06-01T00:00:00.000Z'),
  }
  const paymentTxData = {
    amount: 9000,
    type: 'PAYMENT' as const,
    status: 'INITIATED' as const,
    provider: 'cashfree',
    gatewayOrderId: 'order_abc',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new BookingRepository(mockPrisma as any)
    mockPrisma.tx.booking.create.mockResolvedValue({ id: 'booking-1', bookingRef: 'TRP-2025-0001' })
    mockPrisma.tx.paymentTransaction.create.mockResolvedValue({ id: 'ptx-1' })
  })

  it('creates the Booking and PAYMENT tx but NOT a DEPOSIT_RELEASE row when depositRelease is omitted (Razorpay path)', async () => {
    await repo.createWithPaymentTx(bookingData, paymentTxData)

    expect(mockPrisma.tx.booking.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.tx.paymentTransaction.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.tx.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PAYMENT' }) }),
    )
  })

  it('writes the DEPOSIT_RELEASE row atomically (same $transaction) when depositRelease is provided, with the frozen startDate present in metadata', async () => {
    const computedSplit = {
      entitlement: 8100, deposit: 4050, balance: 4050, baseAmount: 9000, commissionRate: 10,
      hoursUntilTrip: 240, startDate: '2025-07-01T00:00:00.000Z',
    }

    const booking = await repo.createWithPaymentTx(bookingData, paymentTxData, undefined, {
      vendorId: 'vendor-1',
      orderId: 'order_abc',
      amountRupees: 4050,
      metadata: { event: 'payout.deposit.settled', idempotencyKey: 'DEPOSIT_order_abc', computedSplit },
    })

    expect(booking.id).toBe('booking-1')
    // Both the PAYMENT tx and the DEPOSIT_RELEASE tx were created inside the SAME
    // $transaction call (only one $transaction invocation total).
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.tx.paymentTransaction.create).toHaveBeenCalledTimes(2)

    const depositCreateCall = mockPrisma.tx.paymentTransaction.create.mock.calls.find(
      (call) => call[0].data.type === 'DEPOSIT_RELEASE',
    )
    expect(depositCreateCall).toBeDefined()
    expect(depositCreateCall![0].data).toEqual(
      expect.objectContaining({
        bookingId: 'booking-1',
        type: 'DEPOSIT_RELEASE',
        amount: 4050,
        status: 'CAPTURED',
        provider: 'cashfree',
        gatewayOrderId: 'order_abc',
        metadata: expect.objectContaining({
          computedSplit: expect.objectContaining({ startDate: '2025-07-01T00:00:00.000Z' }),
        }),
      }),
    )
  })

  it('rolls back the whole transaction (no orphaned Booking) when the DEPOSIT_RELEASE create fails', async () => {
    // Simulate the DEPOSIT_RELEASE create specifically rejecting — the PAYMENT create
    // (first call) succeeds, the second (DEPOSIT_RELEASE) call fails.
    mockPrisma.tx.paymentTransaction.create
      .mockResolvedValueOnce({ id: 'ptx-payment' })
      .mockRejectedValueOnce(new Error('DB connection lost'))

    await expect(
      repo.createWithPaymentTx(bookingData, paymentTxData, undefined, {
        vendorId: 'vendor-1',
        orderId: 'order_abc',
        amountRupees: 4050,
        metadata: { event: 'payout.deposit.settled', idempotencyKey: 'DEPOSIT_order_abc', computedSplit: {} },
      }),
    ).rejects.toThrow('DB connection lost')

    // The real Prisma $transaction would roll back booking.create too on a callback
    // throw — this test's mock simply verifies createWithPaymentTx propagates the
    // failure rather than swallowing it (per the brief: no idempotency dance for this
    // path — a real failure must roll back the whole transaction).
    expect(mockPrisma.tx.paymentTransaction.create).toHaveBeenCalledTimes(2)
  })

  it('still writes the sublinkAttribution upsert in the same transaction alongside depositRelease', async () => {
    await repo.createWithPaymentTx(
      bookingData,
      paymentTxData,
      { userId: 'user-1', sublinkId: 'sub-1', tripId: 'trip-1' },
      { vendorId: 'vendor-1', orderId: 'order_abc', amountRupees: 4050, metadata: { computedSplit: {} } },
    )

    expect(mockPrisma.tx.sublinkAttribution.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.tx.paymentTransaction.create).toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════
// upsertPrimaryContact (M2 fix — race-safe against the partial unique index
// `TravelerDetail_bookingId_primary_key`, migration 20260724020000)
// ═══════════════════════════════════════════════════════
describe('BookingRepository.upsertPrimaryContact', () => {
  let repo: BookingRepository
  let mockPrisma: {
    travelerDetail: { findFirst: ReturnType<typeof vi.fn>; findFirstOrThrow: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  }

  const contact = { name: 'Alice', phone: '9876543210', phoneVerified: true }

  beforeEach(() => {
    mockPrisma = {
      travelerDetail: {
        findFirst: vi.fn(),
        findFirstOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    }
    repo = new BookingRepository(mockPrisma as any)
  })

  it('updates the existing primary contact when one is already present', async () => {
    mockPrisma.travelerDetail.findFirst.mockResolvedValue({ id: 'td-1' })
    mockPrisma.travelerDetail.update.mockResolvedValue({ id: 'td-1', ...contact })

    const result = await repo.upsertPrimaryContact('booking-1', contact)

    expect(mockPrisma.travelerDetail.update).toHaveBeenCalledWith({ where: { id: 'td-1' }, data: contact })
    expect(mockPrisma.travelerDetail.create).not.toHaveBeenCalled()
    expect(result).toEqual({ id: 'td-1', ...contact })
  })

  it('creates a new primary contact when none exists', async () => {
    mockPrisma.travelerDetail.findFirst.mockResolvedValue(null)
    mockPrisma.travelerDetail.create.mockResolvedValue({ id: 'td-2', ...contact })

    const result = await repo.upsertPrimaryContact('booking-1', contact)

    expect(mockPrisma.travelerDetail.create).toHaveBeenCalledWith({
      data: { ...contact, bookingId: 'booking-1', isPrimary: true },
    })
    expect(result).toEqual({ id: 'td-2', ...contact })
  })

  it('falls back to updating the winner when a concurrent create loses the partial-unique-index race (P2002)', async () => {
    mockPrisma.travelerDetail.findFirst.mockResolvedValue(null)
    mockPrisma.travelerDetail.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      }),
    )
    mockPrisma.travelerDetail.findFirstOrThrow.mockResolvedValue({ id: 'td-winner' })
    mockPrisma.travelerDetail.update.mockResolvedValue({ id: 'td-winner', ...contact })

    const result = await repo.upsertPrimaryContact('booking-1', contact)

    expect(mockPrisma.travelerDetail.findFirstOrThrow).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', isPrimary: true, isDeleted: false },
    })
    expect(mockPrisma.travelerDetail.update).toHaveBeenCalledWith({ where: { id: 'td-winner' }, data: contact })
    expect(result).toEqual({ id: 'td-winner', ...contact })
  })

  it('rethrows non-P2002 errors from create without swallowing them', async () => {
    mockPrisma.travelerDetail.findFirst.mockResolvedValue(null)
    mockPrisma.travelerDetail.create.mockRejectedValue(new Error('DB connection lost'))

    await expect(repo.upsertPrimaryContact('booking-1', contact)).rejects.toThrow('DB connection lost')
    expect(mockPrisma.travelerDetail.findFirstOrThrow).not.toHaveBeenCalled()
  })
})
