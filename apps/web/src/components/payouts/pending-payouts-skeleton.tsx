export function PendingPayoutsSkeleton() {
  return (
    <div className="space-y-3">
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-static space-y-3 p-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-0">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-24" />
              <div className="ml-auto skeleton h-9 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
