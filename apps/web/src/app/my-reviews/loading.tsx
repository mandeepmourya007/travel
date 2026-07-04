export default function MyReviewsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-8 space-y-4">
      <div className="skeleton h-8 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton h-28 w-full rounded-lg" />
      ))}
    </div>
  )
}
