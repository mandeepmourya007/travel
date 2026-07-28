export default function AdminPayoutsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8 space-y-8">
      <div className="skeleton h-8 w-56" />

      <div className="space-y-3">
        <div className="skeleton h-5 w-40" />
        <div className="space-y-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5 last:border-0">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-24" />
              <div className="ml-auto skeleton h-9 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="skeleton h-5 w-56" />
        <div className="flex gap-3">
          <div className="skeleton h-10 w-52" />
          <div className="skeleton h-10 w-40" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
