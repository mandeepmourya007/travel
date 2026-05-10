import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'

export default function DestinationLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {/* Back link skeleton */}
      <div className="mt-4 skeleton h-4 w-28 rounded" />

      {/* Hero skeleton */}
      <div className="mt-4 skeleton h-48 rounded-xl sm:h-64 lg:h-80" />

      {/* Description skeleton */}
      <div className="mt-6 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-10 w-10 rounded-lg" />
            <div className="mt-2 skeleton h-3 w-16 rounded" />
            <div className="mt-1 skeleton h-6 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Trip grid skeleton */}
      <div className="mt-10">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
