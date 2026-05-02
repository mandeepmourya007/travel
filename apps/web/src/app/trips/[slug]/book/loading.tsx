export function BookingPageSkeleton() {
  return (
    <div data-testid="booking-page-skeleton" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: form skeleton */}
      <div className="lg:col-span-2 space-y-6">
        {/* Traveler count */}
        <div className="card p-4 space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-9 w-40" />
        </div>
        {/* Traveler 1 fields */}
        <div className="card p-4 space-y-4">
          <div className="skeleton h-4 w-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-10 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        {/* Pay button */}
        <div className="skeleton h-12 rounded-lg" />
      </div>

      {/* Right: price summary skeleton */}
      <div className="lg:col-span-1">
        <div className="card p-5 space-y-4">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-px w-full" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-px w-full" />
          <div className="flex justify-between">
            <div className="skeleton h-5 w-12" />
            <div className="skeleton h-5 w-20" />
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-3 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BookingLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <BookingPageSkeleton />
    </div>
  )
}
