// ─── Wallet Types ────────────────────────────────────

export const WALLET_TRANSACTION_TYPES = [
  'REFUND',
  'CASHBACK',
  'BOOKING_DEDUCTION',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
  'PROMOTIONAL_CREDIT',
  'EXPIRY',
] as const

export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number]

/** Credit types add to balance; debit types subtract */
export const CREDIT_TYPES: WalletTransactionType[] = [
  'REFUND',
  'CASHBACK',
  'ADMIN_CREDIT',
  'PROMOTIONAL_CREDIT',
]

export const DEBIT_TYPES: WalletTransactionType[] = [
  'BOOKING_DEDUCTION',
  'ADMIN_DEBIT',
  'EXPIRY',
]

// ─── API Response Types ──────────────────────────────

/** GET /wallet — wallet summary for authenticated user */
export interface WalletSummary {
  id: string
  balance: number
  currency: string
  totalCredits: number
  totalDebits: number
  totalCashback: number
  createdAt: string
}

/** Single row in wallet transaction history */
export interface WalletTransactionItem {
  id: string
  amount: number
  type: WalletTransactionType
  referenceModel: string | null
  referenceId: string | null
  description: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
}

/** GET /wallet/transactions query filters */
export interface WalletTransactionFilters {
  type?: WalletTransactionType
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

// ─── Service-level DTOs ──────────────────────────────

/** Input to WalletService.credit() / WalletService.debit() */
export interface WalletTransactionDto {
  userId: string
  amount: number
  type: WalletTransactionType
  referenceModel?: string
  referenceId?: string
  description: string
}

/** Admin credit/debit request body */
export interface AdminWalletActionDto {
  amount: number
  type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT'
  description: string
}

/** Admin view — wallet with user info */
export interface AdminWalletView {
  id: string
  balance: number
  currency: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
}
