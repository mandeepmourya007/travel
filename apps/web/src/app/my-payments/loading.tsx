import { StatItemSkeleton } from '@/components/payments/payment-summary-cards'

export default function MyPaymentsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8 space-y-6">
      <div className="skeleton h-8 w-40" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <StatItemSkeleton key={i} />)}
      </div>
      <div className="flex gap-3">
        <div className="skeleton h-10 w-32" />
        <div className="skeleton h-10 w-32" />
        <div className="skeleton h-10 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
