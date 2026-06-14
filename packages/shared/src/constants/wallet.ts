/** Reference model strings for WalletTransaction.referenceModel */
export const WALLET_REFERENCE_MODELS = {
  BOOKING: 'Booking',
  ADMIN_ACTION: 'AdminAction',
  WALLET_TRANSACTION: 'WalletTransaction', // used by EXPIRY debit (references the credit tx id)
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
} as const

