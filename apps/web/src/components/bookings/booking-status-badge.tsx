'use client'

import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CONFIRMED: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', label: 'Confirmed' },
  PENDING_PAYMENT: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200', label: 'Pending Payment' },
  COMPLETED: { bg: 'bg-info-50', text: 'text-info-700', border: 'border-info-200', label: 'Completed' },
  CANCELLED: { bg: 'bg-error-50', text: 'text-error-700', border: 'border-error-200', label: 'Cancelled' },
  EXPIRED: { bg: 'bg-neutral-100', text: 'text-neutral-500', border: 'border-neutral-200', label: 'Expired' },
  REFUNDED: { bg: 'bg-info-50', text: 'text-info-700', border: 'border-info-200', label: 'Refunded' },
}

interface BookingStatusBadgeProps {
  status: string
  className?: string
}

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.EXPIRED
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style.bg, style.text, style.border,
        className,
      )}
    >
      {style.label}
    </span>
  )
}
