'use client'

import { StarRating } from '@/components/shared/star-rating'
import { EmptyState } from '@/components/shared/data-states'
import { MessageSquare } from 'lucide-react'
import type { TripDetailReview } from '@shared/types/trip.types'

interface TripReviewsProps {
  reviews: TripDetailReview[]
}

export function TripReviews({ reviews }: TripReviewsProps) {
  if (reviews.length === 0) {
    return (
      <section>
        <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">Reviews</h2>
        <EmptyState
          message="No reviews yet. Be the first to share your experience!"
          icon={<MessageSquare className="h-12 w-12 text-neutral-300" />}
        />
      </section>
    )
  }

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
        Reviews ({reviews.length})
      </h2>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-lg border border-neutral-100 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
                {review.user.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-700">
                  {review.user.name}
                </p>
                <p className="text-xs text-neutral-400">
                  {new Date(review.createdAt).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="ml-auto">
                <StarRating rating={review.overallRating} size="sm" />
              </div>
            </div>

            {review.comment && (
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                {review.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
