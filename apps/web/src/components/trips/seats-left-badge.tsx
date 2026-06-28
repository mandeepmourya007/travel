import { cn } from '@/lib/utils'
import { getSeatsLeft, formatSeatsLeft, isSeatsLeftUrgent } from '@/lib/format'

interface SeatsLeftBadgeProps {
  maxGroupSize: number
  currentBookings: number
  className?: string
}

/**
 * Always-visible "seats left" badge — the single source of truth for seat availability display.
 * sold out = error, urgent (≤5) = accent, available = warning (design-system "Seats left" token).
 * Derived from currentBookings/maxGroupSize (trip-level counters), not per-seat status rows.
 */
export function SeatsLeftBadge({ maxGroupSize, currentBookings, className }: SeatsLeftBadgeProps) {
  const seatsLeft = getSeatsLeft(maxGroupSize, currentBookings)
  const urgent = isSeatsLeftUrgent(seatsLeft)
  const label = formatSeatsLeft(seatsLeft)
  const text = urgent ? `Only ${label}!` : label

  return (
    <span
      className={cn(
        'badge text-xs font-semibold',
        seatsLeft === 0
          ? 'bg-error-50 text-error-500'
          : urgent
          ? 'bg-accent-50 text-accent-700'
          : 'bg-warning-50 text-warning-500',
        className,
      )}
    >
      {text}
    </span>
  )
}
