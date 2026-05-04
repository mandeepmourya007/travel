import { StatItemSkeleton } from '@/components/payments/payment-summary-cards'

export default function TripPaymentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-lg" />
        <div className="skeleton h-8 w-48" />
      </div>
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
