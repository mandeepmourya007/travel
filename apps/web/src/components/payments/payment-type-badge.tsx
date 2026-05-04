import { cn } from '@/lib/utils'

interface PaymentTypeBadgeProps {
  type: string
}

const typeConfig: Record<string, { label: string; className: string }> = {
  PAYMENT: { label: 'Payment', className: 'text-neutral-600' },
  REFUND: { label: 'Refund', className: 'text-success-600' },
  ESCROW_RELEASE: { label: 'Escrow', className: 'text-primary-600' },
}

export function PaymentTypeBadge({ type }: PaymentTypeBadgeProps) {
  const config = typeConfig[type] ?? { label: type, className: 'text-neutral-500' }

  return (
    <span className={cn('text-xs font-medium uppercase tracking-wide', config.className)}>
      {config.label}
    </span>
  )
}
