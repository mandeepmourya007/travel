import crypto from 'crypto'
import * as Sentry from '@sentry/node'
import type { Logger } from 'pino'
import { Prisma } from '@prisma/client'
import { assertPayoutSafe } from '@shared/utils/payout'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'
import type { BookingRepository } from '../repositories/booking.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import type { OrganizerPayoutAttemptRepository } from '../repositories/organizer-payout-attempt.repository'
import type { PaymentService } from './payment.service'
import type { WalletService } from './wallet.service'
import type { RazorpayXClient } from '../providers/payout/razorpayx.client'
import { PAYMENT_TX_TYPE, PAYMENT_TX_STATUS, PAYOUT_EVENT, ORGANIZER_PAYOUT_LOCK_TTL_MS, RELEASE_RESULT, ORGANIZER_PAYOUT_ATTEMPT_STATUS } from '../utils/constants'
import { PAYMENT_PROVIDER, PAYMENT_PROVIDER_RAZORPAYX } from '@shared/constants'
import { PaymentError } from '../errors/app-error'
import { withLock } from '../utils/redis-lock'
import { buildIdempotencyKey } from '../utils/idempotency'

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
    /** Dormant until a RazorpayX account exists — see providers/payout/razorpayx.client.ts */
    private razorpayxClient: RazorpayXClient | null = null,
    /** Needed by releaseOrganizerWalletPayout (admin-triggered batch payout) only. */
    private organizerProfileRepo: OrganizerProfileRepository | null = null,
    private walletService: WalletService | null = null,
    /** Ledger-before-gateway-call rows for releaseOrganizerWalletPayout — see schema.prisma
     *  OrganizerPayoutAttempt. Also required (alongside the three above) for that method. */
    private payoutAttemptRepo: OrganizerPayoutAttemptRepository | null = null,
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
  async releaseBalance(bookingId: string): Promise<typeof RELEASE_RESULT.TRANSFERRED | typeof RELEASE_RESULT.SKIPPED | typeof RELEASE_RESULT.FAILED> {
    const booking = await this.bookingRepo.findForBalanceRelease(bookingId)
    if (!booking) {
      this.logger.warn({ bookingId, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Balance release: booking not found')
      return RELEASE_RESULT.FAILED
    }

    const vendorId = booking.trip.organizer?.cashfreeVendorId
    const bookingRef = booking.bookingRef

    if (!vendorId) {
      this.logger.warn({ bookingId, bookingRef, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Balance release: organizer has no cashfreeVendorId')
      return RELEASE_RESULT.FAILED
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
      return RELEASE_RESULT.SKIPPED
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
        return RELEASE_RESULT.SKIPPED
      }
      this.logger.error({ ...logFields, err, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Failed to record BALANCE_RELEASE ledger row')
      return RELEASE_RESULT.FAILED
    }

    try {
      const result = await this.paymentService.transferToVendor(
        vendorId,
        balance,
        { orderId, idempotencyKey, notes: { bookingId, bookingRef } },
        PAYMENT_PROVIDER.CASHFREE,
      )
      this.logger.info({ ...logFields, paymentTxId: releaseTx.id, transferId: result.transferId, event: PAYOUT_EVENT.BALANCE_TRANSFERRED }, 'Balance transferred to organizer')
      return RELEASE_RESULT.TRANSFERRED
    } catch (err) {
      // Ledger row remains CAPTURED with no transferId — cron retry next cycle will hit
      // the P2002 above and skip re-transferring. Ops/admin can reconcile from this log.
      this.logger.error({ ...logFields, paymentTxId: releaseTx.id, err, event: PAYOUT_EVENT.BALANCE_FAILED }, 'Balance transfer to organizer failed — will not auto-retry (BALANCE_RELEASE row already recorded)')
      return RELEASE_RESULT.FAILED
    }
  }

  /**
   * Releases an organizer's earned share via RazorpayX Payouts — the
   * PAYOUT_STRATEGY=razorpayx_payouts analogue of TripLifecycleService's inline
   * ESCROW_RELEASE write for the `route` strategy. Called by
   * TripLifecycleService.resolveAndRelease when razorpayx_payouts is the active strategy.
   *
   * Ledger-before-gateway-call, mirrors releaseBalance:
   * 1. Write the PAYOUT_RELEASE row FIRST (status INITIATED) — P2002 (duplicate,
   *    partial-unique-index-backed) is caught and logged as a skip, gateway is never
   *    called for a duplicate.
   * 2. Call razorpayxClient.createPayout() with the given idempotencyKey.
   * 3. Success -> update row to PROCESSING with gatewayTransferId = payoutId (final
   *    CAPTURED/REVERSED transition happens later via the /webhooks/razorpayx route).
   * 4. Gateway error -> logged, NOT rethrown — row stays INITIATED for a later retry
   *    sweep (analogous to releaseUnreleasedSafePays).
   *
   * Never throws — callers (TripLifecycleService) rely on one booking's failure not
   * killing a batch release.
   */
  async releaseRazorpayXPayout(params: {
    bookingId: string
    bookingRef: string
    fundAccountId: string
    amountPaise: number
    idempotencyKey: string
    notes?: Record<string, unknown>
  }): Promise<typeof RELEASE_RESULT.INITIATED | typeof RELEASE_RESULT.SKIPPED | typeof RELEASE_RESULT.FAILED> {
    const { bookingId, bookingRef, fundAccountId, amountPaise, idempotencyKey, notes } = params
    const logFields = { bookingId, bookingRef, fundAccountId, idempotencyKey, amountPaise, amountRupees: amountPaise / 100 }

    if (!this.razorpayxClient) {
      this.logger.warn({ ...logFields, event: PAYOUT_EVENT.RAZORPAYX_FAILED }, 'RazorpayX client not configured — cannot release payout')
      return RELEASE_RESULT.FAILED
    }

    let releaseTx: { id: string }
    try {
      releaseTx = await this.paymentTxRepo.create({
        bookingId,
        type: PAYMENT_TX_TYPE.PAYOUT_RELEASE,
        amount: Math.round(amountPaise / 100),
        status: PAYMENT_TX_STATUS.INITIATED,
        // LOW-1: RazorpayX Payouts is a distinct provider from the Razorpay PG — tag it
        // separately so PAYOUT_RELEASE rows can be told apart from a Razorpay PG
        // transaction (e.g. in admin reporting/reconciliation).
        provider: PAYMENT_PROVIDER_RAZORPAYX,
        metadata: { event: PAYOUT_EVENT.RAZORPAYX_INITIATED, idempotencyKey },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.info({ ...logFields, event: PAYOUT_EVENT.RAZORPAYX_SKIPPED_DUPLICATE }, 'PAYOUT_RELEASE already exists — skipping duplicate payout')
        return RELEASE_RESULT.SKIPPED
      }
      this.logger.error({ ...logFields, err, event: PAYOUT_EVENT.RAZORPAYX_FAILED }, 'Failed to record PAYOUT_RELEASE ledger row')
      return RELEASE_RESULT.FAILED
    }

    this.logger.info({ ...logFields, paymentTxId: releaseTx.id, event: PAYOUT_EVENT.RAZORPAYX_INITIATED }, 'RazorpayX payout scheduled')

    try {
      const result = await this.razorpayxClient.createPayout({ fundAccountId, amountPaise, idempotencyKey, notes })
      await this.paymentTxRepo.updateStatus(releaseTx.id, PAYMENT_TX_STATUS.PROCESSING, { gatewayTransferId: result.payoutId })
      this.logger.info(
        { ...logFields, paymentTxId: releaseTx.id, payoutId: result.payoutId, event: PAYOUT_EVENT.RAZORPAYX_PROCESSING },
        'RazorpayX payout created — awaiting webhook confirmation',
      )
      return RELEASE_RESULT.INITIATED
    } catch (err) {
      // Ledger row remains INITIATED with no gatewayTransferId — a later retry sweep
      // will hit the P2002 above and skip re-releasing once retried successfully.
      this.logger.error(
        { ...logFields, paymentTxId: releaseTx.id, err, event: PAYOUT_EVENT.RAZORPAYX_FAILED },
        'RazorpayX payout call failed — will not auto-retry (PAYOUT_RELEASE row already recorded)',
      )
      return RELEASE_RESULT.FAILED
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
   * Admin-triggered batch payout of an organizer's accrued wallet-ledger earnings
   * (WALLET_TX.ORGANIZER_EARNING minus ORGANIZER_EARNING_REVERSAL clawbacks) — the
   * weekly/monthly release action, distinct from releaseRazorpayXPayout's automatic
   * per-booking release. See docs/codebase/Payments & Webhooks.md "Organizer earnings
   * via Wallet ledger" and AdminService.releasePayout (the only caller).
   *
   * Sequencing (architect review — this is the one hard requirement of this method):
   * a distributed lock keyed by organizerId is acquired BEFORE reading the wallet balance
   * and held across the ENTIRE sequence below (read balance -> validate amount -> gateway
   * call -> wallet debit) — not just around the debit. A lock that only wraps the debit
   * would let two concurrent release requests both pass the balance check before either
   * reaches the debit, producing two real payouts against one balance.
   *
   * Amount unit note: despite the "Paise" naming in the original design doc, this method
   * works in RUPEES throughout — matching Wallet.balance's existing convention (see
   * WalletService.validateAmount: "whole rupees") and WALLET_TX.ORGANIZER_EARNING's credit
   * amount, which is computed by calculateOrganizerEntitlement directly from Booking.totalAmount
   * (rupees). Conversion to paise happens ONLY at the razorpayxClient.createPayout call
   * boundary, mirroring TripLifecycleService.releaseViaRazorpayX's existing `* 100` conversion.
   *
   * @param params.requestedAmountRupees - Amount to release, in rupees. Omitted = full balance.
   *   Validated against the CURRENT balance inside the lock — never capped; an amount that
   *   exceeds the balance is rejected as 'insufficient_balance' so the admin sees a clear
   *   "exceeds pending balance" and can re-enter.
   */
  async releaseOrganizerWalletPayout(params: {
    organizerId: string
    requestedAmountRupees?: number
  }): Promise<{
    status:
      | typeof RELEASE_RESULT.RELEASED
      | typeof RELEASE_RESULT.INSUFFICIENT_BALANCE
      | typeof RELEASE_RESULT.FAILED
      | typeof RELEASE_RESULT.LEDGER_MISMATCH
    releasedAmountRupees: number
    payoutId?: string
  }> {
    const { organizerId, requestedAmountRupees } = params

    if (!this.organizerProfileRepo || !this.walletService || !this.razorpayxClient || !this.payoutAttemptRepo) {
      this.logger.error(
        { organizerId, event: PAYOUT_EVENT.ORGANIZER_WALLET_FAILED },
        'releaseOrganizerWalletPayout called without organizerProfileRepo/walletService/razorpayxClient/payoutAttemptRepo configured',
      )
      return { status: RELEASE_RESULT.FAILED, releasedAmountRupees: 0 }
    }

    const organizer = await this.organizerProfileRepo.findById(organizerId)
    if (!organizer) {
      this.logger.warn({ organizerId, event: PAYOUT_EVENT.ORGANIZER_WALLET_FAILED }, 'releaseOrganizerWalletPayout: organizer not found')
      return { status: RELEASE_RESULT.FAILED, releasedAmountRupees: 0 }
    }
    const fundAccountId = organizer.razorpayxFundAccountId
    if (!fundAccountId) {
      this.logger.warn({ organizerId, event: PAYOUT_EVENT.ORGANIZER_WALLET_FAILED }, 'releaseOrganizerWalletPayout: organizer has no razorpayxFundAccountId')
      return { status: RELEASE_RESULT.FAILED, releasedAmountRupees: 0 }
    }

    const lockKey = `payout:organizer-wallet:${organizerId}`
    let result: {
      status:
        | typeof RELEASE_RESULT.RELEASED
        | typeof RELEASE_RESULT.INSUFFICIENT_BALANCE
        | typeof RELEASE_RESULT.FAILED
        | typeof RELEASE_RESULT.LEDGER_MISMATCH
      releasedAmountRupees: number
      payoutId?: string
    } = {
      status: RELEASE_RESULT.FAILED,
      releasedAmountRupees: 0,
    }

    // Lock spans the entire check -> gateway-call -> debit sequence — see docblock.
    const lockAcquired = await withLock(lockKey, ORGANIZER_PAYOUT_LOCK_TTL_MS, async () => {
      const balanceSummary = await this.walletService!.getBalance(organizer.userId)
      const balance = balanceSummary.balance
      const amount = requestedAmountRupees ?? balance

      if (amount <= 0 || amount > balance) {
        this.logger.info(
          { organizerId, requestedAmountRupees, balance, event: PAYOUT_EVENT.ORGANIZER_WALLET_INSUFFICIENT_BALANCE },
          'releaseOrganizerWalletPayout: requested amount exceeds pending balance',
        )
        result = { status: RELEASE_RESULT.INSUFFICIENT_BALANCE, releasedAmountRupees: 0 }
        return
      }

      // M2: a slow gateway call can outlive the lock's TTL, letting a concurrent
      // release re-acquire the lock and re-read the (stale) balance above before this
      // call's gateway round-trip even returns. Guard against that by checking for any
      // other INITIATED attempt for this organizer recorded within the recency window
      // (matches the lock's own TTL) — if one exists, refuse rather than risk a
      // double-payout against the same balance.
      const recentAttempt = await this.payoutAttemptRepo!.findRecentInitiated(organizerId)
      if (recentAttempt) {
        this.logger.warn(
          { organizerId, recentAttemptId: recentAttempt.id, event: PAYOUT_EVENT.ORGANIZER_WALLET_FAILED },
          'releaseOrganizerWalletPayout: another release attempt for this organizer is already INITIATED — refusing to call the gateway again',
        )
        result = { status: RELEASE_RESULT.FAILED, releasedAmountRupees: 0 }
        return
      }

      // C1/H1 follow-up: also refuse if a PRIOR attempt reached SUCCEEDED (RazorpayX was
      // paid) but never got a matching wallet debit — see the LEDGER_MISMATCH branch
      // below and findUnreconciledSucceeded's docblock. Without this check, the admin's
      // pending-payout view still shows the organizer's full undebited balance as owed,
      // so a retry would sail past findRecentInitiated (a different attempt id/status)
      // and trigger a SECOND real RazorpayX transfer for money already sent once.
      const unreconciled = await this.payoutAttemptRepo!.findUnreconciledSucceeded(organizerId)
      if (unreconciled) {
        this.logger.error(
          { organizerId, unreconciledAttemptId: unreconciled.id, payoutId: unreconciled.gatewayTransferId, event: PAYOUT_EVENT.ORGANIZER_WALLET_DEBIT_AFTER_PAYOUT_FAILED },
          'releaseOrganizerWalletPayout: a prior attempt already succeeded at the gateway but was never debited from the wallet — refusing to call the gateway again until reconciled',
        )
        result = { status: RELEASE_RESULT.LEDGER_MISMATCH, releasedAmountRupees: 0, payoutId: unreconciled.gatewayTransferId ?? undefined }
        return
      }

      // C1/H1: write the ledger-before-gateway-call row FIRST, inside the lock, before
      // ever calling RazorpayX — mirrors releaseBalance/releaseRazorpayXPayout. The
      // idempotency key is derived from this row's own id (not Date.now()) so retrying
      // the SAME logical release attempt reuses the same gateway idempotency key; a
      // genuinely new release attempt (this method invoked again after a prior attempt
      // reached SUCCEEDED/FAILED) creates a new row and therefore a new key. Hashed (not
      // raw-concatenated) because RazorpayX's X-Payout-Idempotency header caps at 36
      // chars and organizerId alone (UUIDv7) is already 36.
      const attemptId = crypto.randomUUID()
      const idempotencyKey = buildIdempotencyKey('ORG_WALLET_PAYOUT', attemptId)
      const attempt = await this.payoutAttemptRepo!.create({
        id: attemptId,
        organizerId,
        idempotencyKey,
        requestedAmount: amount,
      })

      let payoutId: string
      try {
        const gatewayResult = await this.razorpayxClient!.createPayout({
          fundAccountId,
          amountPaise: amount * 100,
          idempotencyKey,
          notes: { organizerId },
        })
        payoutId = gatewayResult.payoutId
        await this.payoutAttemptRepo!.updateStatus(attempt.id, ORGANIZER_PAYOUT_ATTEMPT_STATUS.SUCCEEDED, payoutId)
      } catch (err) {
        await this.payoutAttemptRepo!.updateStatus(attempt.id, ORGANIZER_PAYOUT_ATTEMPT_STATUS.FAILED)
        this.logger.error(
          { organizerId, amount, attemptId: attempt.id, err, event: PAYOUT_EVENT.ORGANIZER_WALLET_FAILED },
          'releaseOrganizerWalletPayout: RazorpayX createPayout failed — wallet untouched',
        )
        result = { status: RELEASE_RESULT.FAILED, releasedAmountRupees: 0 }
        return
      }

      try {
        await this.walletService!.debit({
          userId: organizer.userId,
          amount,
          type: WALLET_TX.ORGANIZER_PAYOUT,
          referenceModel: WALLET_REFERENCE_MODELS.RAZORPAYX_PAYOUT,
          referenceId: payoutId,
          description: 'Payout sent',
        })
      } catch (err) {
        // Real money has already left the platform via RazorpayX — the ledger debit failing
        // here (a genuine race despite the lock — should be near-impossible) must be LOUD,
        // never swallowed. Manual admin reconciliation required.
        this.logger.error(
          { organizerId, amount, payoutId, err, event: PAYOUT_EVENT.ORGANIZER_WALLET_DEBIT_AFTER_PAYOUT_FAILED },
          'CRITICAL: RazorpayX payout succeeded but wallet debit failed — money sent, ledger not updated',
        )
        Sentry.captureException(err, { extra: { organizerId, amount, payoutId } })
        result = { status: RELEASE_RESULT.LEDGER_MISMATCH, releasedAmountRupees: amount, payoutId }
        return
      }

      this.logger.info(
        { organizerId, amount, payoutId, event: PAYOUT_EVENT.ORGANIZER_WALLET_RELEASED },
        'Organizer wallet payout released',
      )
      result = { status: RELEASE_RESULT.RELEASED, releasedAmountRupees: amount, payoutId }
    })

    if (!lockAcquired) {
      this.logger.warn(
        { organizerId, event: PAYOUT_EVENT.ORGANIZER_WALLET_FAILED },
        'releaseOrganizerWalletPayout: could not acquire lock — a release for this organizer is already in progress',
      )
      return { status: RELEASE_RESULT.FAILED, releasedAmountRupees: 0 }
    }

    return result
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
