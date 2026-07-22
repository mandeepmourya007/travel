import type { CancellationPolicy } from '../types/trip.types'
import { ORGANIZER_DEPOSIT_PERCENT } from '../constants/payment'
import { calculateRefundPercent } from './refund'

/**
 * Deposit/balance payout math — single source of truth for the Cashfree organizer
 * payout split (see docs/codebase/Payments & Webhooks.md).
 *
 * Money model:
 *   T = base customer payment (paise), excluding reseller markup (track-only).
 *   c = organizer commissionRate (percent, e.g. 10).
 *   E = entitlement = round(T * (1 - c/100))            — organizer's total share
 *   D = deposit     = round(E * depositPercent/100)      — released at booking (non-refundable)
 *   B = balance     = E - D                              — held until the refund cliff passes
 *
 * Safety invariant (asserted by callers via assertPayoutSafe, never assumed):
 *   depositPercent <= (100 - maxRefundPercent) guarantees deposit <= platformRetained
 *   always, so a cancellation refund can never require clawing back money already
 *   paid to the organizer.
 *
 * Dependency-free (no Prisma, no I/O) — mirrors refund.ts, trivially unit-testable.
 */

export interface PayoutSplitInput {
  /** Base customer payment in paise — reseller markup already excluded by the caller. */
  baseAmount: number
  /** Organizer commission rate as a percent (e.g. 10 for 10%). */
  commissionRate: number
  /** Percent of entitlement released as deposit at booking time. Defaults to ORGANIZER_DEPOSIT_PERCENT. */
  depositPercent?: number
  /**
   * Maximum refund percent under the applicable cancellation policy. Accepted for
   * context/logging and future policy-parameterization — the actual invariant is
   * enforced on real paise amounts by assertPayoutSafe(deposit, platformRetained),
   * not on these percentages, so passing an inconsistent value here does not itself
   * create an unsafe payout; it would only fail loudly at assertPayoutSafe.
   */
  maxRefundPercent?: number
  /** Hours between now and trip start, at booking time. */
  hoursUntilTrip: number
  /**
   * Trip's cancellation policy — used to derive refundWindowClosed via
   * calculateRefundPercent (refund.ts), the single source of truth for the refund
   * cliff, so this module can never disagree with refund.ts about the boundary.
   */
  cancellationPolicy: CancellationPolicy
}

export interface PayoutSplitResult {
  /** Organizer's total commission-adjusted share (paise). */
  entitlement: number
  /** Non-refundable amount released now (paise). */
  deposit: number
  /** Amount held until the refund cliff passes (paise). deposit + balance === entitlement always. */
  balance: number
  /**
   * True when the refund window was already closed at booking time — derived from
   * calculateRefundPercent(cancellationPolicy, hoursUntilTrip) === 0 (refund.ts is the
   * single source of truth for the cliff boundary; this module never reimplements the
   * comparison), i.e. a refund is impossible (0% under the cancellation policy). In
   * this case deposit is intentionally set to the full entitlement, so the normal
   * deposit<=platformRetained safety check does not apply — callers MUST pass this
   * through to assertPayoutSafe so it skips that check instead of throwing.
   */
  refundWindowClosed: boolean
}

/**
 * Computes the deposit/balance split for an organizer payout.
 *
 * Integer paise math only — entitlement and deposit are each rounded independently
 * with Math.round; balance is derived as (entitlement - deposit), never rounded on
 * its own, so deposit + balance === entitlement always (no rounding drift).
 *
 * Last-minute booking edge case: when the refund window is already closed at booking
 * time (calculateRefundPercent(cancellationPolicy, hoursUntilTrip) === 0), the entire
 * entitlement is already non-refundable, so the full amount is released as deposit and
 * balance is 0 — there is nothing left to hold or release later.
 */
export function calculatePayoutSplit(input: PayoutSplitInput): PayoutSplitResult {
  const { baseAmount, commissionRate, hoursUntilTrip, cancellationPolicy } = input
  const depositPercent = input.depositPercent ?? ORGANIZER_DEPOSIT_PERCENT

  const entitlement = Math.round(baseAmount * (1 - commissionRate / 100))

  // Derived from calculateRefundPercent (refund.ts) rather than reimplementing the
  // cliff here — this is the fix for the 168h boundary contradiction: refund.ts treats
  // hoursUntilTrip === REFUND_CLIFF_DAYS*24 as "refund still possible" (>=), so this
  // must agree exactly, never reimplement the comparison with its own <=/< choice.
  const refundWindowAlreadyClosed = calculateRefundPercent(cancellationPolicy, hoursUntilTrip) === 0
  const deposit = refundWindowAlreadyClosed
    ? entitlement
    : Math.round(entitlement * (depositPercent / 100))
  const balance = entitlement - deposit

  return { entitlement, deposit, balance, refundWindowClosed: refundWindowAlreadyClosed }
}

/**
 * Invariant guard — throws if the deposit about to be released to the organizer
 * exceeds the amount the platform is guaranteed to retain (platformRetained =
 * baseAmount - deposit, i.e. what's left after paying the deposit out).
 *
 * This is the hard backstop against ever needing a clawback: callers MUST call this
 * before attaching a deposit split to a gateway order, and MUST loudly log + Sentry-capture
 * the failure (never silently swallow it) — see payout.service.ts.
 *
 * @param refundWindowClosed - Pass calculatePayoutSplit's `refundWindowClosed` through
 *   unchanged. When true, a refund is impossible (0% under the cancellation policy), so
 *   there is nothing to protect against clawing back — the deposit<=platformRetained
 *   check is skipped entirely and the full entitlement may safely be released.
 * @throws Error — includes both amounts so the failure is diagnosable from the message alone
 */
export function assertPayoutSafe(deposit: number, platformRetained: number, refundWindowClosed = false): void {
  if (refundWindowClosed) return
  if (deposit > platformRetained) {
    throw new Error(
      `Payout safety invariant violated: deposit (${deposit} paise) exceeds platformRetained ` +
        `(${platformRetained} paise) — releasing this deposit could require a future clawback from the organizer.`,
    )
  }
}
