export default function MyBookingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8">
      <div className="skeleton h-8 w-48 mb-6" />
      <div className="skeleton h-10 w-full max-w-md mb-6 rounded-lg" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
