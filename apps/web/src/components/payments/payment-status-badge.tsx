import { cn } from '@/lib/utils'

interface PaymentStatusBadgeProps {
  status: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  CAPTURED: { label: 'Captured', className: 'bg-success-50 text-success-500 ring-success-500/20' },
  INITIATED: { label: 'Pending', className: 'bg-warning-50 text-warning-500 ring-warning-500/20' },
  AUTHORIZED: { label: 'Authorized', className: 'bg-warning-50 text-warning-500 ring-warning-500/20' },
  FAILED: { label: 'Failed', className: 'bg-error-50 text-error-500 ring-error-500/20' },
  REFUNDED: { label: 'Refunded', className: 'bg-primary-50 text-primary-700 ring-primary-200' },
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-neutral-100 text-neutral-600 ring-neutral-200' }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
