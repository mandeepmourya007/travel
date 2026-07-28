/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { PayoutService } from '../../../src/services/payout.service'
import { PaymentError } from '../../../src/errors/app-error'
import { logger } from '../../../src/utils/logger'
import { withLock } from '../../../src/utils/redis-lock'

// Mirrors the mocking style of tests/unit/services/booking.service.test.ts and
// trip-lifecycle.service.test.ts: manual DI with hand-rolled fake repos/services
// (this repo's convention — see .claude/skills/travel-verify). vi.mock() is reserved
// for external SDKs only; Prisma is imported directly for the real P2002 error shape.

// Default: withLock executes fn immediately and returns true (lock acquired) — same
// mock as booking.service.test.ts/trip-lifecycle.service.test.ts, needed because
// releaseOrganizerWalletPayout is lock-guarded and the real implementation would
// otherwise try to connect to Redis.
vi.mock('../../../src/utils/redis-lock', () => ({
  withLock: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<void>) => {
    await fn()
    return true
  }),
}))

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
  updateStatus: vi.fn(),
}

const mockPaymentService = {
  transferToVendor: vi.fn(),
  initiateRefund: vi.fn(),
}

const mockRazorpayxClient = {
  createPayout: vi.fn(),
}

let service: PayoutService

beforeEach(() => {
  vi.clearAllMocks()
  service = new PayoutService(
    mockBookingRepo as any,
    mockPaymentTxRepo as any,
    mockPaymentService as any,
    logger as any,
    mockRazorpayxClient as any,
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
// releaseRazorpayXPayout — ledger-before-gateway-call pattern
// ═══════════════════════════════════════════════════
describe('PayoutService.releaseRazorpayXPayout', () => {
  const params = {
    bookingId: 'booking-rzx-1',
    bookingRef: 'TRP-2025-0010',
    fundAccountId: 'fa_abc123',
    amountPaise: 810000,
    idempotencyKey: 'PAYOUT_booking-rzx-1',
    notes: { tripId: 'trip-1' },
  }

  it('writes the PAYOUT_RELEASE ledger row BEFORE calling the gateway (order asserted via call sequence)', async () => {
    const callOrder: string[] = []
    mockPaymentTxRepo.create.mockImplementation(async () => {
      callOrder.push('ledger-write')
      return { id: 'ptx-rzx-1' }
    })
    mockRazorpayxClient.createPayout.mockImplementation(async () => {
      callOrder.push('gateway-call')
      return { payoutId: 'pout_1', status: 'processing', raw: {} }
    })

    await service.releaseRazorpayXPayout(params)

    expect(callOrder).toEqual(['ledger-write', 'gateway-call'])
  })

  it('records the ledger row with type PAYOUT_RELEASE, status INITIATED, amount in rupees', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-rzx-1' })
    mockRazorpayxClient.createPayout.mockResolvedValue({ payoutId: 'pout_1', status: 'processing', raw: {} })

    await service.releaseRazorpayXPayout(params)

    expect(mockPaymentTxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-rzx-1',
        type: 'PAYOUT_RELEASE',
        status: 'INITIATED',
        amount: 8100, // 810000 paise / 100
        provider: 'razorpayx',
        metadata: expect.objectContaining({ event: 'payout.razorpayx.initiated', idempotencyKey: 'PAYOUT_booking-rzx-1' }),
      }),
    )
  })

  it('on P2002 duplicate ledger write, returns "skipped" and NEVER calls the gateway', async () => {
    mockPaymentTxRepo.create.mockRejectedValue(p2002Error())

    const result = await service.releaseRazorpayXPayout(params)

    expect(result).toBe('skipped')
    expect(mockRazorpayxClient.createPayout).not.toHaveBeenCalled()
  })

  it('on a non-P2002 ledger write failure, returns "failed" without calling the gateway', async () => {
    mockPaymentTxRepo.create.mockRejectedValue(new Error('connection lost'))

    const result = await service.releaseRazorpayXPayout(params)

    expect(result).toBe('failed')
    expect(mockRazorpayxClient.createPayout).not.toHaveBeenCalled()
  })

  it('on gateway success, updates the row to PROCESSING with gatewayTransferId set, and returns "initiated"', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-rzx-1' })
    mockRazorpayxClient.createPayout.mockResolvedValue({ payoutId: 'pout_success_1', status: 'processing', raw: {} })

    const result = await service.releaseRazorpayXPayout(params)

    expect(result).toBe('initiated')
    expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
      'ptx-rzx-1', 'PROCESSING', { gatewayTransferId: 'pout_success_1' },
    )
  })

  it('passes fundAccountId, amountPaise, idempotencyKey, and notes through to createPayout', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-rzx-1' })
    mockRazorpayxClient.createPayout.mockResolvedValue({ payoutId: 'pout_1', status: 'processing', raw: {} })

    await service.releaseRazorpayXPayout(params)

    expect(mockRazorpayxClient.createPayout).toHaveBeenCalledWith({
      fundAccountId: 'fa_abc123',
      amountPaise: 810000,
      idempotencyKey: 'PAYOUT_booking-rzx-1',
      notes: { tripId: 'trip-1' },
    })
  })

  it('on gateway error, returns "failed", does NOT rethrow, and leaves the ledger row at INITIATED (no status update call)', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-rzx-1' })
    mockRazorpayxClient.createPayout.mockRejectedValue(new Error('RazorpayX API timeout'))

    const result = await service.releaseRazorpayXPayout(params)

    expect(result).toBe('failed')
    expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('never throws even when the gateway call fails', async () => {
    mockPaymentTxRepo.create.mockResolvedValue({ id: 'ptx-rzx-1' })
    mockRazorpayxClient.createPayout.mockRejectedValue(new Error('boom'))

    await expect(service.releaseRazorpayXPayout(params)).resolves.toBe('failed')
  })

  it('returns "failed" without writing a ledger row when razorpayxClient is not configured', async () => {
    const serviceNoRzx = new PayoutService(
      mockBookingRepo as any,
      mockPaymentTxRepo as any,
      mockPaymentService as any,
      logger as any,
      null,
    )

    const result = await serviceNoRzx.releaseRazorpayXPayout(params)

    expect(result).toBe('failed')
    expect(mockPaymentTxRepo.create).not.toHaveBeenCalled()
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
// H5: releaseOrganizerWalletPayout — admin-triggered batch payout of an
// organizer's accrued wallet-ledger earnings. Lock-guarded (withLock is a
// pass-through in tests — REDIS_URL is deleted in tests/setup.ts so
// config/redis.ts's `redis` client is null and withLock just calls fn()
// directly). See payout.service.ts docblock for the full sequencing contract.
// ═══════════════════════════════════════════════════
describe('PayoutService.releaseOrganizerWalletPayout', () => {
  const mockOrganizerProfileRepo = {
    findById: vi.fn(),
  }
  const mockWalletService = {
    getBalance: vi.fn(),
    debit: vi.fn(),
  }
  const mockPayoutAttemptRepo = {
    findRecentInitiated: vi.fn(),
    findUnreconciledSucceeded: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }

  let walletService: PayoutService

  const organizer = { id: 'org-1', userId: 'user-org-1', razorpayxFundAccountId: 'fa_org123' }

  beforeEach(() => {
    // Default: no unreconciled SUCCEEDED attempt for this organizer — individual tests
    // that need the ledger_mismatch short-circuit override this.
    mockPayoutAttemptRepo.findUnreconciledSucceeded.mockResolvedValue(null)
    walletService = new PayoutService(
      mockBookingRepo as any,
      mockPaymentTxRepo as any,
      mockPaymentService as any,
      logger as any,
      mockRazorpayxClient as any,
      mockOrganizerProfileRepo as any,
      mockWalletService as any,
      mockPayoutAttemptRepo as any,
    )
  })

  it('(a) happy path: releases the full balance, debits the wallet, and records the attempt as SUCCEEDED', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    mockWalletService.getBalance.mockResolvedValue({ balance: 1000 })
    mockPayoutAttemptRepo.findRecentInitiated.mockResolvedValue(null)
    mockPayoutAttemptRepo.create.mockResolvedValue({ id: 'attempt-1' })
    mockRazorpayxClient.createPayout.mockResolvedValue({ payoutId: 'pout_success', status: 'processing', raw: {} })
    mockWalletService.debit.mockResolvedValue({})

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    expect(result).toEqual({ status: 'released', releasedAmountRupees: 1000, payoutId: 'pout_success' })
    expect(mockPayoutAttemptRepo.updateStatus).toHaveBeenCalledWith('attempt-1', 'SUCCEEDED', 'pout_success')
    expect(mockWalletService.debit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-org-1', amount: 1000, type: 'ORGANIZER_PAYOUT', referenceId: 'pout_success' }),
    )
  })

  it('(b) requestedAmountRupees exceeds balance -> insufficient_balance, gateway never called', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    mockWalletService.getBalance.mockResolvedValue({ balance: 500 })

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1', requestedAmountRupees: 600 })

    expect(result).toEqual({ status: 'insufficient_balance', releasedAmountRupees: 0 })
    expect(mockRazorpayxClient.createPayout).not.toHaveBeenCalled()
    expect(mockPayoutAttemptRepo.create).not.toHaveBeenCalled()
    expect(mockWalletService.debit).not.toHaveBeenCalled()
  })

  it('(c) gateway createPayout throws -> FAILED, wallet debit never called, attempt marked FAILED', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    mockWalletService.getBalance.mockResolvedValue({ balance: 1000 })
    mockPayoutAttemptRepo.findRecentInitiated.mockResolvedValue(null)
    mockPayoutAttemptRepo.create.mockResolvedValue({ id: 'attempt-2' })
    mockRazorpayxClient.createPayout.mockRejectedValue(new Error('RazorpayX API timeout'))

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    expect(result).toEqual({ status: 'failed', releasedAmountRupees: 0 })
    expect(mockWalletService.debit).not.toHaveBeenCalled()
    expect(mockPayoutAttemptRepo.updateStatus).toHaveBeenCalledWith('attempt-2', 'FAILED')
  })

  it('(d) wallet debit throws AFTER a successful gateway call -> reports LEDGER_MISMATCH (money already sent; failure is logged/Sentry-captured for reconciliation, and the caller is told the ledger is out of sync rather than a clean success)', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    mockWalletService.getBalance.mockResolvedValue({ balance: 1000 })
    mockPayoutAttemptRepo.findRecentInitiated.mockResolvedValue(null)
    mockPayoutAttemptRepo.create.mockResolvedValue({ id: 'attempt-3' })
    mockRazorpayxClient.createPayout.mockResolvedValue({ payoutId: 'pout_debit_fail', status: 'processing', raw: {} })
    mockWalletService.debit.mockRejectedValue(new Error('wallet debit failed'))
    const errorSpy = vi.spyOn(logger, 'error')

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    // The gateway call already succeeded — real money left the platform — so the method
    // does not report a clean RELEASED (misleading) nor downgrade to FAILED (money DID
    // move). It reports LEDGER_MISMATCH so callers (e.g. admin UI) know the ledger is out
    // of sync, alongside the loud error log + Sentry capture for manual reconciliation.
    expect(result).toEqual({ status: 'ledger_mismatch', releasedAmountRupees: 1000, payoutId: 'pout_debit_fail' })
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ organizerId: 'org-1', payoutId: 'pout_debit_fail', event: 'payout.organizer_wallet.debit_after_payout_failed' }),
      expect.stringContaining('CRITICAL'),
    )
  })

  it('(e) a recent INITIATED attempt already exists -> FAILED, gateway never called (dedup guard)', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    mockWalletService.getBalance.mockResolvedValue({ balance: 1000 })
    mockPayoutAttemptRepo.findRecentInitiated.mockResolvedValue({ id: 'attempt-in-flight' })

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    expect(result).toEqual({ status: 'failed', releasedAmountRupees: 0 })
    expect(mockRazorpayxClient.createPayout).not.toHaveBeenCalled()
    expect(mockPayoutAttemptRepo.create).not.toHaveBeenCalled()
  })

  it('(f) SECURITY: a prior SUCCEEDED attempt with no matching wallet debit exists -> ledger_mismatch, gateway NEVER called again (no double payout)', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    mockWalletService.getBalance.mockResolvedValue({ balance: 1000 })
    mockPayoutAttemptRepo.findRecentInitiated.mockResolvedValue(null)
    mockPayoutAttemptRepo.findUnreconciledSucceeded.mockResolvedValue({
      id: 'attempt-unreconciled',
      organizerId: 'org-1',
      gatewayTransferId: 'pout_already_sent',
    })

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    expect(result).toEqual({ status: 'ledger_mismatch', releasedAmountRupees: 0, payoutId: 'pout_already_sent' })
    expect(mockRazorpayxClient.createPayout).not.toHaveBeenCalled()
    expect(mockPayoutAttemptRepo.create).not.toHaveBeenCalled()
    expect(mockWalletService.debit).not.toHaveBeenCalled()
  })

  it('returns FAILED without calling any downstream repo/gateway when the Redis lock is not acquired', async () => {
    mockOrganizerProfileRepo.findById.mockResolvedValue(organizer)
    // Simulate a concurrent release already holding the lock for this organizer —
    // withLock resolves false and never invokes the callback.
    vi.mocked(withLock).mockResolvedValueOnce(false)

    const result = await walletService.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    expect(result).toEqual({ status: 'failed', releasedAmountRupees: 0 })
    expect(mockWalletService.getBalance).not.toHaveBeenCalled()
    expect(mockPayoutAttemptRepo.findRecentInitiated).not.toHaveBeenCalled()
    expect(mockRazorpayxClient.createPayout).not.toHaveBeenCalled()
    expect(mockWalletService.debit).not.toHaveBeenCalled()
    expect(mockPayoutAttemptRepo.create).not.toHaveBeenCalled()
  })

  it('returns FAILED immediately when organizerProfileRepo/walletService/razorpayxClient/payoutAttemptRepo are not all configured', async () => {
    const underConfigured = new PayoutService(
      mockBookingRepo as any,
      mockPaymentTxRepo as any,
      mockPaymentService as any,
      logger as any,
      mockRazorpayxClient as any,
      // organizerProfileRepo/walletService/payoutAttemptRepo intentionally omitted
    )

    const result = await underConfigured.releaseOrganizerWalletPayout({ organizerId: 'org-1' })

    expect(result).toEqual({ status: 'failed', releasedAmountRupees: 0 })
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
