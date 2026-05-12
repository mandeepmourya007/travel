'use client'

import { useCallback } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_VEHICLE_PHOTOS } from '@shared/constants/vehicle'

// ─── Props ──────────────────────────────────────────

interface VehicleImageGalleryProps {
  photos: string[]
  onRemove: (index: number) => void
  isUploading: boolean
  uploadProgress: number
  onFileSelect: (files: File[]) => void
  disabled?: boolean
}

// ─── Component ──────────────────────────────────────

export function VehicleImageGallery({
  photos,
  onRemove,
  isUploading,
  uploadProgress,
  onFileSelect,
  disabled = false,
}: VehicleImageGalleryProps) {
  const remaining = MAX_VEHICLE_PHOTOS - photos.length

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      const toUpload = Array.from(files).slice(0, remaining)
      e.target.value = ''
      onFileSelect(toUpload)
    },
    [remaining, onFileSelect],
  )

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((url, idx) => (
          <div
            key={url}
            className="group relative aspect-video overflow-hidden rounded-lg bg-neutral-100"
          >
            <img
              src={url}
              alt={`Vehicle photo ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                disabled={isUploading}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {isUploading && (
          <div className="flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary-300 bg-primary-50">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            <span className="mt-1 text-xs font-medium text-primary-600">
              {uploadProgress}%
            </span>
          </div>
        )}

        {!isUploading && !disabled && photos.length < MAX_VEHICLE_PHOTOS && (
          <label
            className={cn(
              'flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-400 hover:bg-primary-50',
            )}
          >
            <Upload className="h-5 w-5 text-neutral-400" />
            <span className="mt-1 text-xs text-neutral-500">Upload</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        Max {MAX_VEHICLE_PHOTOS} photos per vehicle. Recommended: 16:9, min 800px wide.
      </p>
    </div>
  )
}
