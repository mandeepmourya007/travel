import { z } from 'zod'
import { WALLET_TRANSACTION_TYPES } from '../types/wallet.types'

// ─── Wallet Transaction Filters ──────────────────────

const walletTxTypeEnum = z.enum(WALLET_TRANSACTION_TYPES)

const dateRefine = (v: string) => !isNaN(Date.parse(v))
const dateMessage = { message: 'Must be a valid date string' }

const dateRangeRefine = (data: { fromDate?: string; toDate?: string }) => {
  if (data.fromDate && data.toDate) {
    return new Date(data.fromDate) <= new Date(data.toDate)
  }
  return true
}
const dateRangeMessage = { message: 'fromDate must be before or equal to toDate', path: ['fromDate'] }

/** Validates query params for GET /wallet/transactions */
export const walletTransactionFiltersSchema = z.object({
  type: walletTxTypeEnum.optional(),
  fromDate: z.string().refine(dateRefine, dateMessage).optional(),
  toDate: z.string().refine(dateRefine, dateMessage).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine(dateRangeRefine, dateRangeMessage)

/** Validates body for POST /admin/wallets/:userId */
export const adminWalletActionSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer (whole rupees)'),
  type: z.enum(['ADMIN_CREDIT', 'ADMIN_DEBIT']),
  description: z.string().min(3, 'Description must be at least 3 characters').max(500).trim(),
})
