export default function WalletLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8 space-y-6">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-32 rounded-xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
