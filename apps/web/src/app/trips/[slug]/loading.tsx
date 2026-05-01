export default function TripDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="skeleton h-72 md:h-96 rounded-xl" />
          <div className="space-y-3">
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
          </div>
          <div className="space-y-3">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-4">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-2 rounded-full" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-4" />
              ))}
            </div>
            <div className="skeleton h-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
