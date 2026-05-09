'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { StarRating } from '@/components/shared/star-rating'
import { EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { MessageSquare, MapPin } from 'lucide-react'
import { OrganizerReviewCard } from '@/components/dashboard/organizer-review-card'
import { ReviewCard } from '@/components/trips/review-card'
import type { Review, ReviewSummary } from '@shared/types/review.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

interface TripGroup {
  tripId: string
  title: string
  slug: string
  reviews: Review[]
}

function groupReviewsByTrip(reviews: Review[]): TripGroup[] {
  const map = new Map<string, TripGroup>()
  for (const review of reviews) {
    const key = review.tripId
    if (!map.has(key)) {
      map.set(key, {
        tripId: key,
        title: review.trip?.title ?? 'Unknown Trip',
        slug: review.trip?.slug ?? '',
        reviews: [],
      })
    }
    map.get(key)!.reviews.push(review)
  }
  return Array.from(map.values())
}

interface OrganizerReviewsSectionProps {
  reviews: Review[]
  summary: ReviewSummary
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  isOwner?: boolean
}

export function OrganizerReviewsSection({
  reviews,
  summary,
  pagination,
  onPageChange,
  isOwner = false,
}: OrganizerReviewsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const tripGroups = useMemo(() => groupReviewsByTrip(reviews), [reviews])

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
        Reviews ({summary.totalReviews})
      </h2>

      {/* Rating summary bar */}
      {summary.totalReviews > 0 && (
        <div className="mb-6 flex items-center gap-4 rounded-lg border border-neutral-100 p-4">
          <div className="text-center">
            <p className="font-display text-3xl font-bold text-neutral-800">
              {summary.averageRating.toFixed(1)}
            </p>
            <StarRating rating={summary.averageRating} size="sm" />
            <p className="mt-1 text-xs text-neutral-500">
              {summary.totalReviews} reviews
            </p>
          </div>
          <div className="flex-1 space-y-1">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = summary.distribution[star] ?? 0
              const pct = summary.totalReviews > 0
                ? Math.round((count / summary.totalReviews) * 100)
                : 0
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right text-neutral-500">{star}</span>
                  <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-warning-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-neutral-400">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reviews grouped by trip — collapsed by default */}
      {reviews.length === 0 ? (
        <EmptyState
          message="No reviews yet for this organizer."
          icon={<MessageSquare className="h-12 w-12 text-neutral-300" />}
        />
      ) : (
        <>
          {isExpanded && (
            <div className="space-y-8">
              {tripGroups.map((group) => (
                <div key={group.tripId}>
                  {/* Trip header */}
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary-500" />
                    <Link
                      href={`/trips/${group.slug}`}
                      className="font-display text-base font-semibold text-neutral-800 hover:text-primary-600 transition-colors"
                    >
                      {group.title}
                    </Link>
                    <span className="text-xs text-neutral-400">
                      ({group.reviews.length} review{group.reviews.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {/* Reviews for this trip */}
                  <div className="space-y-3 pl-4 border-l-2 border-primary-300">
                    {group.reviews.map((review) =>
                      isOwner ? (
                        <OrganizerReviewCard key={review.id} review={review} />
                      ) : (
                        <ReviewCard key={review.id} review={review} />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 w-full rounded-xl border border-primary-200 bg-primary-50 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
          >
            {isExpanded ? 'Hide Reviews' : `See All Reviews & Comments (${summary.totalReviews})`}
          </button>
        </>
      )}

      {/* Pagination — only when reviews are visible */}
      {isExpanded && pagination.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </section>
  )
}
