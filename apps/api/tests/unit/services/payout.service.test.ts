/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { PayoutService } from '../../../src/services/payout.service'
import { PaymentError } from '../../../src/errors/app-error'
import { logger } from '../../../src/utils/logger'

// Mirrors the mocking style of tests/unit/services/booking.service.test.ts and
// trip-lifecycle.service.test.ts: manual DI with hand-rolled fake repos/services
// (this repo's convention — see .claude/skills/travel-verify). vi.mock() is reserved
// for external SDKs only; Prisma is imported directly for the real P2002 error shape.

function p2002Error() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

const mockBookingRepo = {
  findForBalanceRelease: vi.fn(),
}

const mockPaymentTxRepo = {
  create: vi.fn(),
  findByBookingId: vi.fn(),
}

const mockPaymentService = {
  transferToVendor: vi.fn(),
  initiateRefund: vi.fn(),
}

let service: PayoutService

beforeEach(() => {
  vi.clearAllMocks()
  service = new PayoutService(
    mockBookingRepo as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
  )
})

// ═══════════════════════════════════════════════════
// releaseDeposit (S1, S2)
// ═══════════════════════════════════════════════════
describe('PayoutService.releaseDeposit', () => {
  const baseParams = {
    bookingId: 'booking-1',
    bookingRef: 'TRP-2025-0001',
    orderId: 'order_abc',
    vendorId: 'vendor-1',
    entitlement: 90000,
    deposit: 45000,
    balance: 45000,
    baseAmount: 100000,
    commissionRate: 10,
    hoursUntilTrip: 24 * 30,
  }

  it('S1: records a DEPOSIT_RELEASE ledger row and logs the deposit-settled event', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-1' })
    const infoSpy = vi.spyOn(logger, 'info')

    await service.releaseDeposit(baseParams)

    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        type: 'DEPOSIT_RELEASE',
        // deposit (45000) is paise — the ledger row must store rupees, matching the
        // PAYMENT/REFUND convention (Math.round(paise / 100)), not the raw paise value.
        amount: 450,
        status: 'CAPTURED',
        provider: 'cashfree',
        gatewayOrderId: 'order_abc',
        metadata: expect.objectContaining({
          event: 'payout.deposit.settled',
          idempotencyKey: 'DEPOSIT_order_abc',
        }),
      }),
    )
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'payout.deposit.settled', paymentTxId: 'ptx-1' }),
      expect.stringContaining('Deposit release recorded'),
    )
  })

  it('S2: on P2002 duplicate, logs a skipped_duplicate event and does not throw', async () => {
    mockPaymentTxRepo.create.mockRejectedValue(p2002Error())
    const infoSpy = vi.spyOn(logger, 'info')

    await expect(service.releaseDeposit(baseParams)).resolves.toBeUndefined()

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'payout.deposit.skipped_duplicate' }),
      expect.stringContaining('skipping duplicate'),
    )
  })

  it('logs and rethrows on a non-P2002 ledger write failure', async () => {
    const dbError = new Error('connection lost')
    mockPaymentTxRepo.create.mockRejectedValue(dbError)
    const errorSpy = vi.spyOn(logger, 'error')

    await expect(service.releaseDeposit(baseParams)).rejects.toThrow('connection lost')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'payout.deposit.failed' }),
      expect.stringContaining('Failed to record'),
    )
  })
})

// ═══════════════════════════════════════════════════
// releaseBalance (S3, S4, S5, S8)
// ═══════════════════════════════════════════════════
describe('PayoutService.releaseBalance', () => {
  const booking = {
    bookingRef: 'TRP-2025-0002',
    trip: { organizer: { cashfreeVendorId: 'vendor-1' } },
  }

  const depositTx = {
    id: 'ptx-deposit',
    type: 'DEPOSIT_RELEASE',
    metadata: { computedSplit: { balance: 45000 } },
  }

  const capturedPaymentTx = {
    id: 'ptx-payment',
    type: 'PAYMENT',
    status: 'CAPTURED',
    provider: 'cashfree',
    gatewayOrderId: 'order_abc',
  }

  it('S3: transfers the held balance and records a BALANCE_RELEASE row when eligible', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([depositTx, capturedPaymentTx])
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-balance' })
    mockPaymentService.transferToVendor.mockResolvedValue({ transferId: 'transfer_1' })

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('transferred')
    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
      // Ledger row stores rupees (450), not the raw paise balance (45000) — the gateway
      // call below is unaffected and still transfers the paise amount.
      expect.objectContaining({ bookingId: 'booking-1', type: 'BALANCE_RELEASE', amount: 450, gatewayOrderId: 'order_abc' }),
    )
    expect(mockPaymentService.transferToVendor).toHaveBeenCalledWith(
      'vendor-1',
      45000,
      expect.objectContaining({ orderId: 'order_abc', idempotencyKey: 'BALANCE_order_abc' }),
      'cashfree',
    )
  })

  it('S4: re-run is idempotent — P2002 on the ledger write skips without calling the gateway', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([depositTx, capturedPaymentTx])
    mockPaymentTxRepo.create.mockRejectedValue(p2002Error())

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('skipped')
    expect(mockPaymentService.transferToVendor).not.toHaveBeenCalled()
  })

  it('S5: skips when the booking has no cashfreeVendorId', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue({
      bookingRef: 'TRP-2025-0003',
      trip: { organizer: { cashfreeVendorId: null } },
    })

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('failed')
    expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
    expect(mockPaymentService.transferToVendor).not.toHaveBeenCalled()
  })

  it('S5: skips when the booking is not found', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(null)

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('failed')
    expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
  })

  it('S5: skips when there is no DEPOSIT_RELEASE tx (nothing to release)', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([capturedPaymentTx]) // no depositTx

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('skipped')
    expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
  })

  it('S5: skips when the computed balance is already 0 (last-minute booking, nothing held)', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([
      { ...depositTx, metadata: { computedSplit: { balance: 0 } } },
      capturedPaymentTx,
    ])

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('skipped')
    expect(mockPaymentService.transferToVendor).not.toHaveBeenCalled()
  })

  it('S5: skips when there is no captured Cashfree PAYMENT tx to derive the orderId from', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([depositTx]) // no capturedPaymentTx

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('skipped')
    expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
  })

  it('S8: gateway transfer throwing is caught, logged with the idempotency key, and does not corrupt the ledger', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([depositTx, capturedPaymentTx])
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-balance' })
    mockPaymentService.transferToVendor.mockRejectedValue(new Error('Cashfree transfer API timeout'))
    const errorSpy = vi.spyOn(logger, 'error')

    const result = await service.releaseBalance('booking-1')

    expect(result).toBe('failed')
    // The BALANCE_RELEASE ledger row was already written (CAPTURED, no transferId) —
    // never thrown away — so the cron's next run will hit the same P2002 above and
    // skip re-transferring rather than double-crediting the organizer.
    expect(mockPaymentTxRepo.create).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'BALANCE_order_abc', event: 'payout.balance.failed' }),
      expect.stringContaining('Balance transfer to organizer failed'),
    )
  })

  it('never throws even when the gateway call fails (cron per-booking isolation contract)', async () => {
    mockBookingRepo.findForBalanceRelease.mockResolvedValue(booking)
    mockPaymentTxRepo.findByBookingId.mockResolvedValue([depositTx, capturedPaymentTx])
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-balance' })
    mockPaymentService.transferToVendor.mockRejectedValue(new Error('boom'))

    await expect(service.releaseBalance('booking-1')).resolves.toBe('failed')
  })
})

// ═══════════════════════════════════════════════════
// refundWithoutClawback (S6)
// ═══════════════════════════════════════════════════
describe('PayoutService.refundWithoutClawback', () => {
  const params = {
    bookingId: 'booking-1',
    bookingRef: 'TRP-2025-0004',
    paymentId: 'pay_abc',
    orderId: 'order_abc',
    vendorId: 'vendor-1',
    refundAmountPaise: 450000,
    reason: 'Trip cancelled',
  }

  it('S6: initiates a refund with the vendor split forced to zero (no organizer clawback)', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund' })
    mockPaymentService.initiateRefund.mockResolvedValue({ refundId: 'rfnd_1' })

    const result = await service.refundWithoutClawback(params)

    expect(result).toEqual({ refundId: 'rfnd_1' })
    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1', type: 'REFUND', status: 'INITIATED' }),
    )
    expect(mockPaymentService.initiateRefund).toHaveBeenCalledWith(
      'pay_abc',
      450000,
      expect.objectContaining({ bookingId: 'booking-1', orderId: 'order_abc', vendorAccountId: 'vendor-1' }),
      'cashfree',
    )
  })

  it('S6: omits vendorAccountId entirely when no vendorId is provided', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund' })
    mockPaymentService.initiateRefund.mockResolvedValue({ refundId: 'rfnd_2' })

    await service.refundWithoutClawback({ ...params, vendorId: null })

    const notes = mockPaymentService.initiateRefund.mock.calls[0][2]
    expect(notes).not.toHaveProperty('vendorAccountId')
  })

  it('returns null (does not throw) when the gateway refund call fails — REFUND tx remains INITIATED for retry', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-refund' })
    mockPaymentService.initiateRefund.mockRejectedValue(new Error('gateway down'))

    const result = await service.refundWithoutClawback(params)

    expect(result).toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// assertSafeOrThrow (S9)
// ═══════════════════════════════════════════════════
describe('PayoutService.assertSafeOrThrow', () => {
  it('does not throw when deposit <= platformRetained', () => {
    expect(() => service.assertSafeOrThrow({ deposit: 100, platformRetained: 100 })).not.toThrow()
  })

  it('S9: logs the invariant-violated event and rethrows when deposit > platformRetained', () => {
    const errorSpy = vi.spyOn(logger, 'error')

    expect(() =>
      service.assertSafeOrThrow({ bookingRef: 'TRP-2025-0005', deposit: 600, platformRetained: 400 }),
    ).toThrow(/Payout safety invariant violated/)

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ bookingRef: 'TRP-2025-0005', event: 'payout.invariant.violated' }),
      expect.stringContaining('invariant violated'),
    )
  })

  it('H1: rethrows a typed PaymentError (statusCode 502, code PAYMENT_FAILED) wrapping the original bare Error as cause', () => {
    let caught: unknown
    try {
      service.assertSafeOrThrow({ bookingRef: 'TRP-2025-0005', deposit: 600, platformRetained: 400 })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(PaymentError)
    expect((caught as PaymentError).statusCode).toBe(502)
    expect((caught as PaymentError).code).toBe('PAYMENT_FAILED')
    expect((caught as PaymentError).cause).toBeInstanceOf(Error)
    expect((caught as Error).cause).not.toBeInstanceOf(PaymentError)
  })
})
