export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startStr = startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  const endStr = endDate.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
