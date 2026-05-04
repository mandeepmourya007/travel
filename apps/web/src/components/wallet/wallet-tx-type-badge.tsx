import { cn } from '@/lib/utils'
import type { WalletTransactionType } from '@shared/types/wallet.types'

interface WalletTxTypeBadgeProps {
  type: WalletTransactionType
}

const TYPE_CONFIG: Record<WalletTransactionType, { label: string; className: string }> = {
  REFUND: { label: 'Refund', className: 'bg-success-50 text-success-700' },
  CASHBACK: { label: 'Cashback', className: 'bg-highlight-50 text-highlight-700' },
  BOOKING_DEDUCTION: { label: 'Booking', className: 'bg-accent-50 text-accent-700' },
  ADMIN_CREDIT: { label: 'Admin Credit', className: 'bg-primary-50 text-primary-700' },
  ADMIN_DEBIT: { label: 'Admin Debit', className: 'bg-error-50 text-error-700' },
  PROMOTIONAL_CREDIT: { label: 'Promo', className: 'bg-highlight-50 text-highlight-700' },
  EXPIRY: { label: 'Expired', className: 'bg-neutral-100 text-neutral-600' },
}

export function WalletTxTypeBadge({ type }: WalletTxTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? { label: type, className: 'bg-neutral-100 text-neutral-600' }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
