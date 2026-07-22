// ─── Payment Providers ────────────────────────────────

export const PAYMENT_PROVIDERS = ['razorpay', 'cashfree'] as const
export type PaymentProviderConst = (typeof PAYMENT_PROVIDERS)[number]

/** Object form for dot-access: PAYMENT_PROVIDER.RAZORPAY — derived from array */
export const PAYMENT_PROVIDER = Object.fromEntries(
  PAYMENT_PROVIDERS.map((s) => [s.toUpperCase(), s]),
) as { readonly RAZORPAY: 'razorpay'; readonly CASHFREE: 'cashfree' }

// ─── Payment Transaction Types ────────────────────────
// ESCROW_RELEASE is stored in the DB and cannot be renamed without a data migration.
// DEPOSIT_RELEASE / BALANCE_RELEASE back the Cashfree deposit/balance payout split
// (see utils/payout.ts) — ESCROW_RELEASE remains the Razorpay-only SafePay path.
export const PAYMENT_TYPES = ['PAYMENT', 'REFUND', 'ESCROW_RELEASE', 'DEPOSIT_RELEASE', 'BALANCE_RELEASE'] as const
export type PaymentTypeConst = (typeof PAYMENT_TYPES)[number]

/** Object form for dot-access: PAYMENT_TYPE.PAYMENT — derived from array */
export const PAYMENT_TYPE = Object.fromEntries(
  PAYMENT_TYPES.map((s) => [s, s]),
) as { readonly [K in PaymentTypeConst]: K }

// ─── Deposit / Balance Payout Tunables ────────────────
// Single source of truth for the Cashfree deposit/balance payout split (utils/payout.ts)
// and the refund-cliff policy (utils/refund.ts). These two values are chosen so that
// ORGANIZER_DEPOSIT_PERCENT <= (100 - MAX_REFUND_PERCENT) always — i.e. the platform
// never releases more to the organizer than the guaranteed-non-refundable share.
// MAX_REFUND_PERCENT is derived (not hand-duplicated) so the invariant can't silently drift.

/** Percent of organizer entitlement released as a non-refundable deposit at booking time. */
export const ORGANIZER_DEPOSIT_PERCENT = 50

/** Refund window: >= this many days before trip start, cancellation refunds MAX_REFUND_PERCENT; else 0%. */
export const REFUND_CLIFF_DAYS = 7

/** Maximum refund percent once inside the refund window — derived from ORGANIZER_DEPOSIT_PERCENT. */
export const MAX_REFUND_PERCENT = 100 - ORGANIZER_DEPOSIT_PERCENT

// ─── Payment Transaction Statuses ─────────────────────

export const PAYMENT_STATUSES = ['INITIATED', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'FAILED'] as const
export type PaymentStatusConst = (typeof PAYMENT_STATUSES)[number]

/** Object form for dot-access: PAYMENT_STATUS.CAPTURED — derived from array */
export const PAYMENT_STATUS = Object.fromEntries(
  PAYMENT_STATUSES.map((s) => [s, s]),
) as { readonly [K in PaymentStatusConst]: K }

// ─── Cashfree Vendor/Beneficiary Account Types ────────
// Required for Cashfree Easy Split vendor KYC; ignored by Razorpay Route.

export const CASHFREE_ACCOUNT_TYPES = ['INDIVIDUAL', 'BUSINESS'] as const
export type CashfreeAccountTypeConst = (typeof CASHFREE_ACCOUNT_TYPES)[number]

/** Object form for dot-access: CASHFREE_ACCOUNT_TYPE.INDIVIDUAL — derived from array */
export const CASHFREE_ACCOUNT_TYPE = Object.fromEntries(
  CASHFREE_ACCOUNT_TYPES.map((s) => [s, s]),
) as { readonly [K in CashfreeAccountTypeConst]: K }
