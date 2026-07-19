import * as Sentry from '@sentry/node'
import type { Logger } from 'pino'
import { Prisma } from '@prisma/client'
import { assertPayoutSafe } from '@shared/utils/payout'
import type { BookingRepository } from '../repositories/booking.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { PaymentService } from './payment.service'
import { PAYMENT_TX_TYPE, PAYMENT_TX_STATUS, PAYOUT_EVENT } from '../utils/constants'
import { PAYMENT_PROVIDER } from '@shared/constants'
import { PaymentError } from '../errors/app-error'

/**
 * Single choke-point for Cashfree deposit/balance payout side-effects, so
 * booking/cron/refund callers stay thin. See utils/payout.ts (packages/shared) for the
 * pure math and docs/codebase/Payments & Webhooks.md for the money-flow overview.
 *
 * Responsibility split between this service and booking.service.ts:
 * - The DEPOSIT tranche rides on Cashfree's createOrder call (order_splits[] must be
 *   present at order creation — there is no separate "attach deposit" API call). That
 *   gateway call necessarily happens in booking.service.ts, BEFORE the Booking row even
 *   exists (order creation precedes booking creation in the create-booking flow), so the
 *   usual "write the ledger row before the gateway call" idempotency pattern cannot apply
 *   verbatim to the deposit — there is no bookingId yet at the time of that call. Instead,
 *   booking.service.ts computes+asserts the split BEFORE calling createOrder (so an unsafe
 *   split never reaches the gateway), and this service's releaseDeposit() records the
 *   DEPOSIT_RELEASE ledger row immediately AFTER the booking (and its order) exist,
 *   documenting a split that has already been baked into the just-created order.
 * - The BALANCE tranche is a genuinely separate, later, on-demand gateway call
 *   (transferToVendor), so it follows the standard ledger-row-before-gateway-call
 *   idempotency pattern used by TripLifecycleService.resolveAndRelease.
 */
export class PayoutService {
  constructor(
    private bookingRepo: BookingRepository,
    private paymentTxRepo: PaymentTransactionRepository,
    private paymentService: PaymentService,
    private logger: Logger,
  ) {}

  /**
   * Records the DEPOSIT_RELEASE ledger row for a booking whose Cashfree order was
   * created with the deposit already attached via order_splits[]. See class docblock
   * for why this doesn't precede a gateway call the way releaseBalance's does.
   *
   * Idempotent via the partial-unique index on PaymentTransaction(bookingId) WHERE
   * type='DEPOSIT_RELEASE' — a P2002 here is logged as a duplicate-skip, never thrown.
   */
  async releaseDeposit(params: {
    bookingId: string
    bookingRef: string
    orderId: string
    vendorId: string
    entitlement: number
    deposit: number
    balance: number
    baseAmount: number
    commissionRate: number
    hoursUntilTrip: number
  }): Promise<void> {
    const { bookingId, bookingRef, orderId, vendorId, entitlement, deposit, balance, baseAmount, commissionRate, hoursUntilTrip } = params
    const idempotencyKey = `DEPOSIT_${orderId}`

    const logFields = {
      bookingId, bookingRef, orderId, vendorId, provider: PAYMENT_PROVIDER.CASHFREE,
      baseAmountPaise: baseAmount, baseAmountRupees: baseAmount / 100,
      entitlementPaise: entitlement, entitlementRupees: entitlement / 100,
      depositPaise: deposit, depositRupees: deposit / 100,
      balancePaise: balance, balanceRupees: balance / 100,
      platformRetainedPaise: baseAmount - deposit, platformRetainedRupees: (baseAmount - deposit) / 100,
      commissionRate, hoursUntilTrip,
    }

    try {
      const tx = await this.paymentTxRepo.create({
        bookingId,
        type: PAYMENT_TX_TYPE.DEPOSIT_RELEASE,
        // Ledger amount is stored in RUPEES everywhere (PAYMENT/REFUND rows), while
        // deposit/balance here are paise (from calculatePayoutSplit on baseAmountInPaise)
        // — convert before writing, same convention as refundWithoutClawback below.
        amount: Math.round(deposit / 100),
        status: PAYMENT_TX_STATUS.CAPTURED,
        provider: PAYMENT_PROVIDER.CASHFREE,
        gatewayOrderId: orderId,
        metadata: {
          event: PAYOUT_EVENT.DEPOSIT_SETTLED,
          idempotencyKey,
          computedSplit: { entitlement, deposit, balance, baseAmount, commissionRate, hoursUntilTrip },
        },
      })
      this.logger.info({ ...logFields, paymentTxId: tx.id, event: PAYOUT_EVENT.DEPOSIT_SETTLED }, 'Deposit release recorded')
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.info({ ...logFields, event: PAYOUT_EVENT.DEPOSIT_SKIPPED_DUPLICATE }, 'DEPOSIT_RELEASE already exists — skipping duplicate ledger write')
        return
      }
      this.logger.error({ ...logFields, err, event: PAYOUT_EVENT.DEPOSIT_FAILED }, 'Failed to record DEPOSIT_RELEASE ledger row')
      throw err
    }
  }

  /**
   * Releases the held balance tranche for a booking once the refund cliff has passed.
   * Called per-booking by the balance-release cron.
   *
   * Steps (ledger-before-gateway-call, mirrors TripLifecycleService.resolveAndRelease):
   * 1. Resolve booking + organizer vendorId + captured order + held balance amount.
   * 2. Write the BALANCE_RELEASE row FIRST — P2002 (duplicate) is caught and logged as a
   *    skip, never thrown, and the gateway is never called for a duplicate.
   * 3. Call gateway.transferToVendor() with idempotency key BALANCE_${orderId}.
   * 4. Gateway errors are caught, logged at error with the idempotency key, and NOT
   *    rethrown — the cron retries next run (the DB row already exists so retries are
   *    safe: this method returns early at step 2 next time without re-transferring).
   *
   * Never throws — callers (the cron) rely on one booking's failure not killing the batch.
   */
  async releaseBalance(bookingId: string): Promise<'transferred' | 'skipped' | 'failed'> {
    const booking = await this.bookingRepo.findForBalanceRelease(bookingId)
    if (!booking) {
      this.logger.warn({ bookingId, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Balance release: booking not found')
      return 'failed'
    }

    const vendorId = booking.trip.organizer?.cashfreeVendorId
    const bookingRef = booking.bookingRef

    if (!vendorId) {
      this.logger.warn({ bookingId, bookingRef, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Balance release: organizer has no cashfreeVendorId')
      return 'failed'
    }

    const txList = await this.paymentTxRepo.findByBookingId(bookingId)
    const depositTx = txList.find((tx) => tx.type === PAYMENT_TX_TYPE.DEPOSIT_RELEASE)
    const capturedPaymentTx = txList.find(
      (tx) => tx.type === PAYMENT_TX_TYPE.PAYMENT && tx.status === PAYMENT_TX_STATUS.CAPTURED && tx.provider === PAYMENT_PROVIDER.CASHFREE,
    )
    const orderId = capturedPaymentTx?.gatewayOrderId ?? capturedPaymentTx?.razorpayOrderId

    const computedSplit = (depositTx?.metadata as { computedSplit?: { balance?: number } } | null)?.computedSplit
    const balance = computedSplit?.balance ?? 0

    if (!orderId || !depositTx || balance <= 0) {
      this.logger.info(
        { bookingId, bookingRef, vendorId, orderId, balance, event: PAYOUT_EVENT.BALANCE_SKIPPED_DUPLICATE },
        'Balance release: nothing to release (no deposit split, no captured order, or balance already 0)',
      )
      return 'skipped'
    }

    const idempotencyKey = `BALANCE_${orderId}`
    const logFields = { bookingId, bookingRef, orderId, vendorId, paymentTxId: depositTx.id, provider: PAYMENT_PROVIDER.CASHFREE, idempotencyKey, balancePaise: balance, balanceRupees: balance / 100 }

    this.logger.info({ ...logFields, event: PAYOUT_EVENT.BALANCE_SCHEDULED }, 'Balance release scheduled')

    let releaseTx: { id: string }
    try {
      releaseTx = await this.paymentTxRepo.create({
        bookingId,
        type: PAYMENT_TX_TYPE.BALANCE_RELEASE,
        // See releaseDeposit above — ledger amount is rupees, balance here is paise.
        amount: Math.round(balance / 100),
        status: PAYMENT_TX_STATUS.CAPTURED,
        provider: PAYMENT_PROVIDER.CASHFREE,
        gatewayOrderId: orderId,
        metadata: { event: PAYOUT_EVENT.BALANCE_TRANSFERRED, idempotencyKey },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.info({ ...logFields, event: PAYOUT_EVENT.BALANCE_SKIPPED_DUPLICATE }, 'BALANCE_RELEASE already exists — skipping duplicate transfer')
        return 'skipped'
      }
      this.logger.error({ ...logFields, err, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Failed to record BALANCE_RELEASE ledger row')
      return 'failed'
    }

    try {
      const result = await this.paymentService.transferToVendor(
        vendorId,
        balance,
        { orderId, idempotencyKey, notes: { bookingId, bookingRef } },
        PAYMENT_PROVIDER.CASHFREE,
      )
      this.logger.info({ ...logFields, paymentTxId: releaseTx.id, transferId: result.transferId, event: PAYOUT_EVENT.BALANCE_TRANSFERRED }, 'Balance transferred to organizer')
      return 'transferred'
    } catch (err) {
      // Ledger row remains CAPTURED with no transferId — cron retry next cycle will hit
      // the P2002 above and skip re-transferring. Ops/admin can reconcile from this log.
      this.logger.error({ ...logFields, paymentTxId: releaseTx.id, err, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Balance transfer to organizer failed — will not auto-retry (BALANCE_RELEASE row already recorded)')
      return 'failed'
    }
  }

  /**
   * Issues a refund without ever clawing back the organizer's deposit. Writes a REFUND
   * ledger row then calls the gateway with a zero-amount vendor split — safe by
   * construction because the deposit released to the organizer is always
   * <= the platform-retained amount (see utils/payout.ts).
   *
   * This is the standalone equivalent of booking.service.ts's initiateBookingRefund for
   * callers outside the booking-cancellation flow (e.g. a future admin-initiated refund).
   * booking.service.ts's cancelBooking path continues to use its own initiateBookingRefund
   * (which has additional double-refund/retry guards this method intentionally does not
   * duplicate) — that method also passes vendorAccountId through so cancellations get the
   * same no-clawback behaviour.
   */
  async refundWithoutClawback(params: {
    bookingId: string
    bookingRef: string
    paymentId: string
    orderId: string
    vendorId: string | null
    refundAmountPaise: number
    reason: string
  }): Promise<{ refundId: string } | null> {
    const { bookingId, bookingRef, paymentId, orderId, vendorId, refundAmountPaise, reason } = params
    const logFields = { bookingId, bookingRef, orderId, vendorId, provider: PAYMENT_PROVIDER.CASHFREE, refundAmountPaise, refundAmountRupees: refundAmountPaise / 100 }

    const refundTx = await this.paymentTxRepo.create({
      bookingId,
      type: PAYMENT_TX_TYPE.REFUND,
      amount: Math.round(refundAmountPaise / 100),
      status: PAYMENT_TX_STATUS.INITIATED,
      provider: PAYMENT_PROVIDER.CASHFREE,
      metadata: { reason },
    })

    this.logger.info({ ...logFields, paymentTxId: refundTx.id, event: PAYOUT_EVENT.REFUND_INITIATED }, 'No-clawback refund initiated')

    try {
      const result = await this.paymentService.initiateRefund(
        paymentId,
        refundAmountPaise,
        { bookingId, reason, orderId, ...(vendorId ? { vendorAccountId: vendorId } : {}) },
        PAYMENT_PROVIDER.CASHFREE,
      )
      this.logger.info({ ...logFields, paymentTxId: refundTx.id, refundId: result.refundId, event: PAYOUT_EVENT.REFUND_NO_CLAWBACK }, 'Refund completed with zero organizer clawback')
      return result
    } catch (err) {
      this.logger.error({ ...logFields, paymentTxId: refundTx.id, err }, 'No-clawback refund gateway call failed — REFUND tx remains INITIATED for retry')
      return null
    }
  }

  /**
   * Validates the deposit/platform-retained invariant, logging and Sentry-capturing
   * loudly on violation before letting the throw propagate — per the observability
   * spec, this is the one place a throw at booking-creation time is correct: it
   * happens BEFORE any gateway call, so no money has moved yet.
   *
   * @throws PaymentError — wraps the bare Error thrown by assertPayoutSafe, after logging/Sentry-capture
   */
  assertSafeOrThrow(ctx: { bookingRef?: string; tripId?: string; userId?: string; deposit: number; platformRetained: number; refundWindowClosed?: boolean }): void {
    try {
      assertPayoutSafe(ctx.deposit, ctx.platformRetained, ctx.refundWindowClosed)
    } catch (err) {
      this.logger.error({ ...ctx, event: PAYOUT_EVENT.INVARIANT_VIOLATED }, 'Payout safety invariant violated — refusing to attach deposit split')
      Sentry.captureException(err, { extra: ctx })
      throw new PaymentError('Payout safety invariant violated', err)
    }
  }
}
