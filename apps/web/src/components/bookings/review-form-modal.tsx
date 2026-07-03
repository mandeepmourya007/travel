'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, ImagePlus, Loader2, X, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { Modal } from '@/components/shared/modal'
import { ImageLightbox, useLightbox } from '@/components/shared/image-lightbox'
import { StarRatingInput } from '@/components/shared/star-rating-input'
import { useCreateReview, useUpdateReview } from '@/hooks/use-reviews'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { REVIEW_MAX_PHOTOS, REVIEW_MAX_COMMENT_LENGTH } from '@shared/constants/review'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from '@shared/constants/upload'
import type { Review } from '@shared/types/review.types'

// ── Per-photo upload state ────────────────────────────────────────────────────

type PhotoItem =
  | { id: string; state: 'uploading'; localPreview: string }
  | { id: string; state: 'done'; url: string; localPreview: string }
  | { id: string; state: 'error'; localPreview: string; message: string }

// ── PhotoUploadSection ────────────────────────────────────────────────────────

interface PhotoUploadSectionProps {
  items: PhotoItem[]
  onFiles: (files: File[]) => void
  onRemove: (id: string) => void
  onPreview: (index: number) => void
}

function PhotoUploadSection({ items, onFiles, onRemove, onPreview }: PhotoUploadSectionProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const dragDepth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Only count non-error items toward the cap — error tiles shouldn't lock out new uploads
  const activeCount = items.filter((p) => p.state !== 'error').length
  const atMax = activeCount >= REVIEW_MAX_PHOTOS
  const hasItems = items.length > 0

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      // Remaining slots exclude error tiles so failed uploads don't eat the quota (M1)
      const remaining = REVIEW_MAX_PHOTOS - activeCount
      if (remaining <= 0) return
      const list = Array.from(files).slice(0, remaining)
      onFiles(list)
    },
    [activeCount, onFiles],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current++
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setIsDragActive(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  // Lightbox needs URLs of done items only
  const doneUrls = items.filter((p): p is Extract<PhotoItem, { state: 'done' }> => p.state === 'done').map((p) => p.url)

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700">
          Photos <span className="text-neutral-400 font-normal">(optional)</span>
        </label>
        {hasItems && (
          <span className="text-xs text-neutral-400">
            {activeCount} / {REVIEW_MAX_PHOTOS} added
          </span>
        )}
      </div>

      {/* Drop zone — shown when below max */}
      {!atMax && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photos — drag and drop or click to browse"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 transition-colors duration-150',
            isDragActive
              ? 'border-primary-400 bg-primary-50 text-primary-600'
              : 'border-neutral-200 bg-neutral-50 text-neutral-400 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-500',
          ].join(' ')}
        >
          {isDragActive ? (
            <>
              <ImagePlus className="h-7 w-7" />
              <p className="text-sm font-medium">Drop to upload</p>
            </>
          ) : (
            <>
              <Camera className="h-7 w-7" />
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-600">
                  Drop photos here or <span className="text-primary-600">browse</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Up to {REVIEW_MAX_PHOTOS} photos · JPG, PNG, WEBP · max {MAX_UPLOAD_SIZE_MB} MB each
                </p>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Max reached banner */}
      {atMax && (
        <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700">
          <Camera className="h-4 w-4 shrink-0" />
          Max {REVIEW_MAX_PHOTOS} photos reached
        </div>
      )}

      {/* Photo grid */}
      {hasItems && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item, i) => {
            const previewSrc = item.state === 'done' ? item.url : item.localPreview
            const doneIndex = doneUrls.indexOf(item.state === 'done' ? item.url : '')

            return (
              <div
                key={item.id}
                className="group relative h-20 w-20 animate-fade-in overflow-hidden rounded-lg border border-neutral-200"
              >
                {/* Image (always shown as background using blob/cdn url) */}
                <Image
                  src={previewSrc}
                  alt={`Review photo ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={previewSrc.startsWith('blob:')}
                />

                {/* Uploading overlay */}
                {item.state === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}

                {/* Error overlay */}
                {item.state === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-error-500/85 px-1">
                    <AlertCircle className="h-4 w-4 shrink-0 text-white" />
                    <p className="text-center text-[10px] leading-tight text-white">{item.message}</p>
                  </div>
                )}

                {/* Click to preview (done photos only) */}
                {item.state === 'done' && doneIndex >= 0 && (
                  <button
                    type="button"
                    onClick={() => onPreview(doneIndex)}
                    className="absolute inset-0"
                    aria-label={`Preview photo ${i + 1}`}
                  />
                )}

                {/* Remove button — always visible on mobile, hover-only on sm+ */}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ReviewFormModal ───────────────────────────────────────────────────────────

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

  // Per-photo state — existing review photos seeded as 'done'
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(() =>
    (existingReview?.photos ?? []).map((url) => ({
      id: crypto.randomUUID(),
      state: 'done' as const,
      url,
      localPreview: url,
    })),
  )

  const createReview = useCreateReview()
  const updateReview = useUpdateReview()
  const { upload } = useCloudinaryUpload()
  const lightbox = useLightbox()

  const isPending = createReview.isPending || updateReview.isPending
  const isUploadingAny = photoItems.some((p) => p.state === 'uploading')
  const canSubmit = overallRating >= 1 && !isPending && !isUploadingAny

  // Track every blob URL created imperatively so the unmount cleanup always has
  // the full list — a useEffect with [] would capture a stale photoItems closure.
  const createdBlobUrls = useRef<string[]>([])

  useEffect(() => {
    return () => {
      createdBlobUrls.current.forEach(URL.revokeObjectURL)
    }
  }, [])

  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles: Array<{ file: File; id: string; preview: string }> = []
      const errorItems: PhotoItem[] = []

      for (const file of files) {
        const id = crypto.randomUUID()
        const blobUrl = URL.createObjectURL(file)
        createdBlobUrls.current.push(blobUrl)

        if (!file.type.startsWith('image/')) {
          errorItems.push({ id, state: 'error', localPreview: blobUrl, message: 'Not an image' })
          continue
        }
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          errorItems.push({ id, state: 'error', localPreview: blobUrl, message: `Over ${MAX_UPLOAD_SIZE_MB} MB` })
          continue
        }
        validFiles.push({ file, id, preview: blobUrl })
      }

      // Add uploading + error placeholders immediately so UI updates before async uploads
      setPhotoItems((prev) => [
        ...prev,
        ...validFiles.map(({ id, preview }): PhotoItem => ({
          id, state: 'uploading', localPreview: preview,
        })),
        ...errorItems,
      ])

      // Upload valid files concurrently
      validFiles.forEach(({ file, id, preview }) => {
        upload(file, 'trips')
          .then((url) => {
            // Revoke blob URL as soon as Cloudinary URL is available; remove from
            // cleanup ref so unmount doesn't double-revoke it.
            URL.revokeObjectURL(preview)
            createdBlobUrls.current = createdBlobUrls.current.filter((u) => u !== preview)
            setPhotoItems((prev) =>
              prev.map((p) =>
                p.id === id ? { id, state: 'done', url, localPreview: url } : p,
              ),
            )
          })
          .catch(() => {
            setPhotoItems((prev) =>
              prev.map((p) =>
                p.id === id ? { id, state: 'error', localPreview: preview, message: 'Upload failed' } : p,
              ),
            )
          })
      })
    },
    [upload],
  )

  const handleRemove = useCallback((id: string) => {
    setPhotoItems((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item && 'localPreview' in item && item.localPreview.startsWith('blob:')) {
        URL.revokeObjectURL(item.localPreview)
      }
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const handlePreview = useCallback(
    (doneIndex: number) => {
      const doneUrls = photoItems
        .filter((p): p is Extract<PhotoItem, { state: 'done' }> => p.state === 'done')
        .map((p) => p.url)
      lightbox.open(doneUrls, doneIndex)
    },
    [photoItems, lightbox],
  )

  const handleSubmit = () => {
    if (!canSubmit) return

    const photos = photoItems
      .filter((p): p is Extract<PhotoItem, { state: 'done' }> => p.state === 'done')
      .map((p) => p.url)

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

          {/* Sub-ratings — optional */}
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
            <p className="mt-1 text-right text-xs text-neutral-400">
              {comment.length}/{REVIEW_MAX_COMMENT_LENGTH}
            </p>
          </div>

          {/* Photo Upload */}
          <PhotoUploadSection
            items={photoItems}
            onFiles={handleFiles}
            onRemove={handleRemove}
            onPreview={handlePreview}
          />
        </div>
      </Modal>
      {lightbox.lightboxProps && <ImageLightbox {...lightbox.lightboxProps} />}
    </>
  )
}
