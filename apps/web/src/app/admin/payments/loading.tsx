import { PaymentSummaryCardsSkeleton } from '@/components/payments/payment-summary-cards'

export default function AdminPaymentsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8 space-y-6">
      <div className="skeleton h-8 w-48" />
      <PaymentSummaryCardsSkeleton cols="lg" />
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
