'use client'

import { useState } from 'react'
import { Pencil, CornerDownRight } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import { ReviewFormModal } from '@/components/bookings/review-form-modal'
import { formatDateFull } from '@/lib/format'
import { REVIEW_EDIT_WINDOW_DAYS } from '@shared/constants/review'
import type { Review } from '@shared/types/review.types'

interface TravelerReviewCardProps {
  review: Review
}

export function TravelerReviewCard({ review }: TravelerReviewCardProps) {
  const [editOpen, setEditOpen] = useState(false)

  const daysSince = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  const canEdit = daysSince <= REVIEW_EDIT_WINDOW_DAYS

  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-4">
      {/* Trip badge */}
      {review.trip && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-600">
          {review.trip.title}
        </p>
      )}

      {/* Rating + meta row */}
      <div className="flex items-center justify-between gap-2">
        <StarRating rating={review.overallRating} size="sm" />
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-neutral-400">{formatDateFull(review.createdAt)}</span>
          {review.editedAt && (
            <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
              <Pencil className="h-2.5 w-2.5" />
              Edited
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="btn-ghost inline-flex items-center gap-1 py-1 px-2 text-xs"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{review.comment}</p>
      )}

      {/* Organizer reply */}
      {review.organizerReply && (
        <div className="mt-3 ml-4 rounded-lg border-l-2 border-primary-200 bg-primary-50/50 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <CornerDownRight className="h-3 w-3 text-primary-500" />
            <span className="text-xs font-semibold text-primary-700">Organizer replied</span>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed">{review.organizerReply}</p>
        </div>
      )}

      {editOpen && (
        <ReviewFormModal
          bookingId={review.bookingId}
          tripId={review.tripId}
          tripTitle={review.trip?.title ?? ''}
          existingReview={review}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}
