'use client'

import { Users, IndianRupee, Clock, Armchair } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import type { TripBookingSummary } from '@shared/types/booking.types'

/** Props for the trip-level summary stats bar (Swiggy-style order summary) */
interface TripStatsBarProps {
  summary: TripBookingSummary
}

export function TripStatsBar({ summary }: TripStatsBarProps) {
  const bookedRatio = summary.maxGroupSize > 0
    ? summary.totalTravelers / summary.maxGroupSize
    : 0

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatMini
        label="Paid & Booked"
        value={`${summary.totalTravelers}/${summary.maxGroupSize}`}
        icon={<Users className="h-5 w-5" />}
        color={bookedRatio >= 1 ? 'red' : bookedRatio >= 0.8 ? 'amber' : 'green'}
      />
      <StatMini
        label="Revenue"
        value={formatCurrency(summary.revenue)}
        icon={<IndianRupee className="h-5 w-5" />}
        color="green"
      />
      <StatMini
        label="Pending Requests"
        value={String(summary.pendingRequestsCount)}
        icon={<Clock className="h-5 w-5" />}
        color={summary.pendingRequestsCount > 0 ? 'amber' : 'green'}
      />
      <StatMini
        label="Seats Left"
        value={String(summary.seatsLeft)}
        icon={<Armchair className="h-5 w-5" />}
        color={summary.seatsLeft === 0 ? 'red' : summary.seatsLeft <= 3 ? 'amber' : 'green'}
      />
    </div>
  )
}

function StatMini({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'green' | 'amber' | 'red'
}) {
  const colorClasses = {
    green: 'bg-success-50 text-success-600',
    amber: 'bg-warning-50 text-warning-600',
    red: 'bg-error-50 text-error-500',
  }

  return (
    <div className="card-static flex items-center gap-3 p-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorClasses[color])}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-neutral-800">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
    </div>
  )
}

export function TripStatsBarSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card-static flex items-center gap-3 p-4">
          <div className="skeleton h-10 w-10 rounded-lg" />
          <div className="space-y-1">
            <div className="skeleton h-5 w-16" />
            <div className="skeleton h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
