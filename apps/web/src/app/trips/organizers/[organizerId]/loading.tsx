import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'

export default function OrganizerProfileLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back link skeleton */}
      <div className="skeleton h-4 w-32 mb-6" />

      {/* Header skeleton */}
      <div className="rounded-xl border border-neutral-100 bg-white p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="skeleton h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-3 w-full">
            <div className="skeleton h-7 w-48" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-full max-w-md" />
            <div className="flex gap-4">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* Trips section skeleton */}
      <div className="mt-10">
        <div className="skeleton h-7 w-56 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Reviews section skeleton */}
      <div className="mt-10">
        <div className="skeleton h-7 w-40 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-100 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-3 w-16" />
                </div>
                <div className="skeleton h-4 w-20" />
              </div>
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
