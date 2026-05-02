export default function CompareLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="skeleton h-5 w-24 mb-2" />
      <div className="skeleton h-7 sm:h-8 w-48 sm:w-56 mb-6" />

      {/* Product header skeleton — side-by-side cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center space-y-2">
            <div className="skeleton aspect-square w-full max-w-36 sm:max-w-44 rounded-lg" />
            <div className="skeleton h-3 sm:h-4 w-3/4" />
            <div className="skeleton h-4 sm:h-5 w-1/2" />
            <div className="skeleton h-2.5 w-2/3" />
          </div>
        ))}
      </div>

      {/* Comparison table skeleton */}
      <div className="mt-6 space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton h-8 w-full rounded-none" />
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-0">
              <div className="skeleton h-10 w-16 sm:w-24 rounded-none" />
              <div className="skeleton h-10 w-full rounded-none" />
              <div className="skeleton h-10 w-full rounded-none" />
              <div className="skeleton h-10 w-full rounded-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
