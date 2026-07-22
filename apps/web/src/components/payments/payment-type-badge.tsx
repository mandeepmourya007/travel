import { cn } from '@/lib/utils'
import { PAYMENT_TYPE } from '@shared/constants'

interface PaymentTypeBadgeProps {
  type: string
  isPartialRefund?: boolean
}

const typeConfig: Record<string, { label: string; className: string }> = {
  [PAYMENT_TYPE.PAYMENT]: { label: 'Payment', className: 'text-neutral-600' },
  [PAYMENT_TYPE.REFUND]: { label: 'Refund', className: 'text-success-600' },
  [PAYMENT_TYPE.ESCROW_RELEASE]: { label: 'Payout', className: 'text-primary-600' },
}

export function PaymentTypeBadge({ type, isPartialRefund }: PaymentTypeBadgeProps) {
  const config = typeConfig[type] ?? { label: type, className: 'text-neutral-500' }
  const label = type === PAYMENT_TYPE.REFUND && isPartialRefund ? 'Partial Refund' : config.label

  return (
    <span className={cn('text-xs font-medium uppercase tracking-wide', config.className)}>
      {label}
    </span>
  )
}
