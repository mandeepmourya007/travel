'use client'

import { useCallback } from 'react'
import { useFormContext, useFieldArray } from 'react-hook-form'
import { Upload, X, Loader2 } from 'lucide-react'
import { FormField } from './form-field'
import { useCloudinaryUpload } from '@/hooks/use-cloudinary-upload'
import { useToast } from '@/components/shared/toast'
import type { CreateTripDto } from '@shared/types/trip.types'

export function MediaTab() {
  const { register, control, watch, formState: { errors } } = useFormContext<CreateTripDto>()
  const { uploadMany, isUploading, uploadProgress } = useCloudinaryUpload()
  const { toast } = useToast()

  const { append: addPhoto, remove: removePhoto } = useFieldArray({
    control,
    name: 'photos' as never,
  })

  const photoUrls = watch('photos') || []

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const remaining = 8 - photoUrls.length
      const toUpload = Array.from(files).slice(0, remaining)
      e.target.value = ''

      try {
        const urls = await uploadMany(toUpload, 'trips')
        for (const url of urls) {
          addPhoto(url as never)
        }
      } catch {
        toast({ variant: 'error', title: 'Failed to upload photos. Please try again.' })
      }
    },
    [addPhoto, photoUrls.length, uploadMany, toast],
  )

  return (
    <div className="space-y-6">
      {/* Photo Upload */}
      <FormField label="Trip Photos" error={errors.photos?.message}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photoUrls.map((url: string, idx: number) => (
            <div key={idx} className="group relative aspect-video overflow-hidden rounded-lg bg-neutral-100">
              <img src={url} alt={`Trip photo ${idx + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                disabled={isUploading}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {idx === 0 && (
                <span className="absolute left-1 top-1 rounded bg-primary-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Cover
                </span>
              )}
            </div>
          ))}

          {isUploading && (
            <div className="flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary-300 bg-primary-50">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              <span className="mt-1 text-xs font-medium text-primary-600">{uploadProgress}%</span>
            </div>
          )}

          {!isUploading && photoUrls.length < 8 && (
            <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-400 hover:bg-primary-50">
              <Upload className="h-6 w-6 text-neutral-400" />
              <span className="mt-1 text-xs text-neutral-500">Upload</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Max 8 photos. First photo is the cover image. Recommended: 16:9, min 1200px wide.
        </p>
      </FormField>

      {/* Itinerary Doc URL */}
      <FormField label="Itinerary Document URL" error={errors.itineraryDocUrl?.message}>
        <input
          {...register('itineraryDocUrl')}
          placeholder="https://drive.google.com/..."
          className="input"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Link to a detailed itinerary PDF or Google Doc.
        </p>
      </FormField>
    </div>
  )
}
