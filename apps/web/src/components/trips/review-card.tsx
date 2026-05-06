'use client'

import Image from 'next/image'
import { StarRating } from '@/components/shared/star-rating'
import { ImageLightbox, useLightbox } from '@/components/shared/image-lightbox'
import { formatDateFull } from '@/lib/format'
import { Pencil, CornerDownRight } from 'lucide-react'
import type { Review } from '@shared/types/review.types'

interface ReviewCardProps {
  review: Review
}

export function ReviewCard({ review }: ReviewCardProps) {
  const lightbox = useLightbox()

  return (
    <div className="rounded-lg border border-neutral-100 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
          {review.user.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-700">
            {review.user.name}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-neutral-400">
              {formatDateFull(review.createdAt)}
            </p>
            {review.editedAt && (
              <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
                <Pencil className="h-2.5 w-2.5" />
                Edited
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto">
          <StarRating rating={review.overallRating} size="sm" />
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
          {review.comment}
        </p>
      )}

      {/* Photos */}
      {review.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((url, i) => (
            <button
              type="button"
              key={url}
              onClick={() => lightbox.open(review.photos, i)}
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200 cursor-pointer transition-opacity hover:opacity-80"
            >
              <Image
                src={url}
                alt={`Review photo ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Organizer reply */}
      {review.organizerReply && (
        <div className="mt-3 ml-4 rounded-lg border-l-2 border-primary-200 bg-primary-50/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CornerDownRight className="h-3 w-3 text-primary-500" />
            <span className="text-xs font-semibold text-primary-700">Organizer replied</span>
            {review.organizerReplyAt && (
              <span className="text-xs text-neutral-400">
                · {formatDateFull(review.organizerReplyAt)}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {review.organizerReply}
          </p>
        </div>
      )}

      {lightbox.lightboxProps && <ImageLightbox {...lightbox.lightboxProps} />}
    </div>
  )
}
