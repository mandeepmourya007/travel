export default function DestinationsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {/* Title skeleton */}
      <div className="mt-8 skeleton h-8 w-72 rounded" />
      <div className="mt-2 skeleton h-5 w-48 rounded" />

      {/* Search skeleton */}
      <div className="mt-6 skeleton h-10 w-full rounded-lg" />

      {/* Tabs skeleton */}
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
