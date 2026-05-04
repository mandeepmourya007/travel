'use client'

import { cn } from '@/lib/utils'
import { WALLET_TRANSACTION_TYPES } from '@shared/types/wallet.types'
import type { WalletTransactionType } from '@shared/types/wallet.types'

interface WalletFiltersProps {
  activeType?: WalletTransactionType
  onTypeChange: (type: WalletTransactionType | undefined) => void
}

const TYPE_LABELS: Record<WalletTransactionType, string> = {
  REFUND: 'Refunds',
  CASHBACK: 'Cashback',
  BOOKING_DEDUCTION: 'Bookings',
  ADMIN_CREDIT: 'Admin Credit',
  ADMIN_DEBIT: 'Admin Debit',
  PROMOTIONAL_CREDIT: 'Promo',
  EXPIRY: 'Expired',
}

export function WalletFilters({ activeType, onTypeChange }: WalletFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onTypeChange(undefined)}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          !activeType
            ? 'bg-primary-600 text-white'
            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
        )}
      >
        All
      </button>
      {WALLET_TRANSACTION_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onTypeChange(activeType === type ? undefined : type)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            activeType === type
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
          )}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  )
}
