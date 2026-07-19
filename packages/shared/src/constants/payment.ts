// ─── Payment Providers ────────────────────────────────

export const PAYMENT_PROVIDERS = ['razorpay', 'cashfree'] as const
export type PaymentProviderConst = (typeof PAYMENT_PROVIDERS)[number]

/** Object form for dot-access: PAYMENT_PROVIDER.RAZORPAY — derived from array */
export const PAYMENT_PROVIDER = Object.fromEntries(
  PAYMENT_PROVIDERS.map((s) => [s.toUpperCase(), s]),
) as { readonly RAZORPAY: 'razorpay'; readonly CASHFREE: 'cashfree' }

// ─── Payment Transaction Types ────────────────────────
// ESCROW_RELEASE is stored in the DB and cannot be renamed without a data migration.
export const PAYMENT_TYPES = ['PAYMENT', 'REFUND', 'ESCROW_RELEASE'] as const
export type PaymentTypeConst = (typeof PAYMENT_TYPES)[number]

/** Object form for dot-access: PAYMENT_TYPE.PAYMENT — derived from array */
export const PAYMENT_TYPE = Object.fromEntries(
  PAYMENT_TYPES.map((s) => [s, s]),
) as { readonly [K in PaymentTypeConst]: K }

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
