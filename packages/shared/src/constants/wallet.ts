/** Reference model strings for WalletTransaction.referenceModel */
export const WALLET_REFERENCE_MODELS = {
  BOOKING: 'Booking',
  ADMIN_ACTION: 'AdminAction',
  WALLET_TRANSACTION: 'WalletTransaction', // used by EXPIRY debit (references the credit tx id)
  // Organizer wallet payout ledger — referenceId is the RazorpayX payoutId (not a DB row).
  RAZORPAYX_PAYOUT: 'RazorpayXPayout',
} as const

export type WalletReferenceModel =
  (typeof WALLET_REFERENCE_MODELS)[keyof typeof WALLET_REFERENCE_MODELS]

/** Commonly used wallet transaction type constants (mirrors WALLET_TRANSACTION_TYPES enum) */
export const WALLET_TX = {
  CASHBACK: 'CASHBACK',
  REFUND: 'REFUND',
  BOOKING_DEDUCTION: 'BOOKING_DEDUCTION',
  ADMIN_CREDIT: 'ADMIN_CREDIT',
  ADMIN_DEBIT: 'ADMIN_DEBIT',
  PROMOTIONAL_CREDIT: 'PROMOTIONAL_CREDIT',
  EXPIRY: 'EXPIRY',
  // Organizer earnings ledger (RazorpayX Payouts strategy only — gated on
  // env.PAYOUT_STRATEGY === 'razorpayx_payouts'). See docs/codebase/Payments & Webhooks.md.
  ORGANIZER_EARNING: 'ORGANIZER_EARNING',
  ORGANIZER_EARNING_REVERSAL: 'ORGANIZER_EARNING_REVERSAL',
  ORGANIZER_PAYOUT: 'ORGANIZER_PAYOUT',
  ORGANIZER_PAYOUT_REVERSED: 'ORGANIZER_PAYOUT_REVERSED',
} as const

/** The four organizer-wallet-ledger transaction types — used by admin payout list default filter. */
export const ORGANIZER_WALLET_TX_TYPES = [
  WALLET_TX.ORGANIZER_EARNING,
  WALLET_TX.ORGANIZER_EARNING_REVERSAL,
  WALLET_TX.ORGANIZER_PAYOUT,
  WALLET_TX.ORGANIZER_PAYOUT_REVERSED,
] as const

export type OrganizerWalletTxType = (typeof ORGANIZER_WALLET_TX_TYPES)[number]

