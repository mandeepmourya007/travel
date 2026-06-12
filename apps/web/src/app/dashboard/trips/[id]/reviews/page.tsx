'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { deslugify } from '@shared/utils/slug'
import { useTripReviews } from '@/hooks/use-reviews'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { StarRating } from '@/components/shared/star-rating'
import { Pagination } from '@/components/shared/pagination'
import { OrganizerReviewCard } from '@/components/dashboard/organizer-review-card'

export default function DashboardTripReviewsPage() {
  const { id: tripId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const tripSlug = searchParams.get('trip')
  const tripName = tripSlug ? deslugify(tripSlug) : null
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useTripReviews(tripId, { page, limit: 10 })

  const header = (
    <div className="flex items-center gap-3 mb-6">
      <Link href="/dashboard/trips" className="btn-ghost p-2" aria-label="Back to my trips">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h1 className="font-display text-xl font-bold text-neutral-800">
        {tripName ? `Reviews — ${tripName}` : 'Trip Reviews'}
      </h1>
    </div>
  )

  if (isLoading) {
    return (
      <div>
        {header}
        <div className="space-y-4">
          <div className="skeleton h-20 w-full rounded-lg" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        {header}
        <ErrorState title="Couldn't load reviews" message={error.message} onRetry={refetch} />
      </div>
    )
  }

  if (!data || data.reviews.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          message="No reviews for this trip yet."
          icon={<MessageSquare className="h-12 w-12 text-neutral-300" />}
        />
      </div>
    )
  }

  const { reviews, summary } = data

  return (
    <div>
      {header}

      {/* Rating summary bar */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-neutral-900">{summary.averageRating}</span>
          <div>
            <StarRating rating={summary.averageRating} size="md" />
            <p className="text-xs text-neutral-500 mt-0.5">{summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {/* Distribution bars */}
        <div className="flex-1 space-y-1">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = summary.distribution[star] ?? 0
            const pct = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-right text-neutral-500">{star}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-warning-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-neutral-400">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Review list with reply capability */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <OrganizerReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-6">
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
