import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'

export default function TripsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="skeleton h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
