const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  })
}

export function formatDateFull(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  })
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startStr = startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: DEFAULT_TIMEZONE })
  const endStr = endDate.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  })
  return `${startStr} – ${endStr}`
}

export function getTripDuration(start: string, end: string): string {
  const days =
    Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24),
    ) + 1
  const nights = days - 1
  return `${days}D/${nights}N`
}

export function getSeatsLeft(max: number, current: number): number {
  return Math.max(0, max - current)
}

export const SEATS_LEFT_URGENCY_THRESHOLD = 5

export function formatSeatsLeft(seatsLeft: number): string {
  if (seatsLeft === 0) return 'Sold out'
  if (seatsLeft === 1) return '1 seat left'
  return `${seatsLeft} seats left`
}

export function isSeatsLeftUrgent(seatsLeft: number): boolean {
  return seatsLeft > 0 && seatsLeft <= SEATS_LEFT_URGENCY_THRESHOLD
}

export function tripTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ADVENTURE: 'Adventure',
    WEEKEND: 'Weekend',
    TREKKING: 'Trekking',
    BEACH: 'Beach',
    CULTURAL: 'Cultural',
    ROAD_TRIP: 'Road Trip',
  }
  return labels[type] || type
}

export function timeAgo(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 0) return 'in the future'
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(date.toISOString())
}
