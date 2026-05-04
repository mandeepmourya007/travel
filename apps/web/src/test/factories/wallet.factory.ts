import type { WalletTransactionItem, WalletSummary } from '@shared/types/wallet.types'

let counter = 0

export function resetWalletFactory() {
  counter = 0
}

export function makeWalletSummary(overrides: Partial<WalletSummary> = {}): WalletSummary {
  return {
    id: 'wallet_1',
    balance: 2500,
    currency: 'INR',
    totalCredits: 3500,
    totalDebits: 1000,
    totalCashback: 225,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeWalletTxItem(overrides: Partial<WalletTransactionItem> = {}): WalletTransactionItem {
  counter++
  return {
    id: `wtx_${counter}`,
    amount: 500,
    type: 'REFUND',
    referenceModel: 'Booking',
    referenceId: `booking_${counter}`,
    description: `Refund for booking #TRP-2025-000${counter}`,
    balanceBefore: 1000,
    balanceAfter: 1500,
    createdAt: '2025-01-15T10:30:00Z',
    ...overrides,
  }
}
