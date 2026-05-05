'use client'

import { useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { Modal } from '@/components/shared/modal'
import { ImageLightbox, useLightbox } from '@/components/shared/image-lightbox'
import { StarRatingInput } from '@/components/shared/star-rating-input'
import { useCreateReview, useUpdateReview } from '@/hooks/use-reviews'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { REVIEW_MAX_PHOTOS, REVIEW_MAX_COMMENT_LENGTH } from '@shared/constants/review'
import type { Review } from '@shared/types/review.types'

interface ReviewFormModalProps {
  bookingId: string
  tripId: string
  tripTitle: string
  onClose: () => void
  existingReview?: Review | null
}

export function ReviewFormModal({
  bookingId,
  tripId,
  tripTitle,
  onClose,
  existingReview,
}: ReviewFormModalProps) {
  const isEditing = !!existingReview

  // Form state
  const [overallRating, setOverallRating] = useState(existingReview?.overallRating ?? 0)
  const [organizationRating, setOrganizationRating] = useState(existingReview?.organizationRating ?? 0)
  const [valueRating, setValueRating] = useState(existingReview?.valueRating ?? 0)
  const [safetyRating, setSafetyRating] = useState(existingReview?.safetyRating ?? 0)
  const [accuracyRating, setAccuracyRating] = useState(existingReview?.accuracyRating ?? 0)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [photos, setPhotos] = useState<string[]>(existingReview?.photos ?? [])

  const createReview = useCreateReview()
  const updateReview = useUpdateReview()
  const { upload, isUploading } = useCloudinaryUpload()
  const lightbox = useLightbox()

  const isPending = createReview.isPending || updateReview.isPending
  const canSubmit = overallRating >= 1 && !isPending && !isUploading

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const remaining = REVIEW_MAX_PHOTOS - photos.length
    const toUpload = files.slice(0, remaining)
    if (toUpload.length === 0) return

    const urls = await Promise.all(toUpload.map((file) => upload(file, 'trips')))
    setPhotos((prev) => [...prev, ...urls])
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!canSubmit) return

    const data = {
      overallRating,
      ...(organizationRating > 0 && { organizationRating }),
      ...(valueRating > 0 && { valueRating }),
      ...(safetyRating > 0 && { safetyRating }),
      ...(accuracyRating > 0 && { accuracyRating }),
      ...(comment.trim() && { comment: comment.trim() }),
      ...(photos.length > 0 && { photos }),
    }

    if (isEditing && existingReview) {
      updateReview.mutate(
        { reviewId: existingReview.id, dto: data },
        { onSuccess: () => onClose() },
      )
    } else {
      createReview.mutate(
        { ...data, tripId, bookingId },
        { onSuccess: () => onClose() },
      )
    }
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="btn-ghost text-sm"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-primary py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEditing ? 'Updating...' : 'Submitting...'}
          </span>
        ) : (
          isEditing ? 'Update Review' : 'Submit Review'
        )}
      </button>
    </>
  )

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title={isEditing ? 'Edit Review' : 'Write a Review'}
      footer={footer}
      className="max-w-lg"
    >
      <div className="space-y-5">
        {/* Trip name */}
        <div className="rounded-lg bg-neutral-50 px-3 py-2">
          <p className="text-sm font-medium text-neutral-700">{tripTitle}</p>
        </div>

        {/* Overall Rating — required */}
        <div>
          <StarRatingInput
            value={overallRating}
            onChange={setOverallRating}
            size="lg"
            label="Overall Rating *"
          />
          {overallRating === 0 && (
            <p className="mt-1 text-xs text-neutral-400">Tap a star to rate</p>
          )}
        </div>

        {/* Sub-ratings — optional, collapsible feel */}
        <div className="space-y-3 rounded-lg border border-neutral-100 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Detailed Ratings (optional)
          </p>
          <StarRatingInput
            value={organizationRating}
            onChange={setOrganizationRating}
            size="sm"
            label="Organization"
          />
          <StarRatingInput
            value={valueRating}
            onChange={setValueRating}
            size="sm"
            label="Value for Money"
          />
          <StarRatingInput
            value={safetyRating}
            onChange={setSafetyRating}
            size="sm"
            label="Safety"
          />
          <StarRatingInput
            value={accuracyRating}
            onChange={setAccuracyRating}
            size="sm"
            label="Accuracy"
          />
        </div>

        {/* Comment */}
        <div>
          <label htmlFor="review-comment" className="mb-1 block text-sm font-medium text-neutral-700">
            Comment (optional)
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell others about your experience..."
            rows={4}
            maxLength={REVIEW_MAX_COMMENT_LENGTH}
            className="input resize-none"
          />
          <p className="mt-1 text-xs text-neutral-400 text-right">
            {comment.length}/{REVIEW_MAX_COMMENT_LENGTH}
          </p>
        </div>

        {/* Photo Upload */}
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Photos (optional, max {REVIEW_MAX_PHOTOS})
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => lightbox.open(photos, i)}
                  className="h-full w-full"
                >
                  <Image
                    src={url}
                    alt={`Review photo ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-4 w-4 text-white" />
                </button>
              </div>
            ))}
            {photos.length < REVIEW_MAX_PHOTOS && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-primary-400 hover:text-primary-500">
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </Modal>
    {lightbox.lightboxProps && <ImageLightbox {...lightbox.lightboxProps} />}
  </>
  )
}
