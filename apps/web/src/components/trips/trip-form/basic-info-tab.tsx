'use client'

import { useState, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { useDestinations } from '@/hooks/use-destinations'
import { useTripCategories } from '@/hooks/use-trip-categories'
import { FormField } from './form-field'
import type { CreateTripDto } from '@shared/types/trip.types'

const BOOKING_MODES = [
  { value: 'INSTANT', label: 'Instant Booking' },
  { value: 'REQUEST_BASED', label: 'Request Based' },
] as const

export function BasicInfoTab() {
  const { register, formState: { errors }, setValue, watch } = useFormContext<CreateTripDto>()
  const { data: destinations } = useDestinations()
  const { data: tripCategories } = useTripCategories()
  const currentVal = watch('destinationId')
  const isExistingId = destinations?.some((d) => d.id === currentVal)
  const [useCustom, setUseCustom] = useState(false)

  // Sync custom mode when destinations load — prevents showing raw CUID on edit
  useEffect(() => {
    if (!destinations) return
    setUseCustom(!isExistingId && !!currentVal)
  }, [destinations, isExistingId, currentVal])

  return (
    <div className="space-y-6">
      <FormField label="Trip Title" error={errors.title?.message} required>
        <input
          {...register('title')}
          placeholder="e.g. Goa Beach Getaway"
          className="input"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Destination" error={errors.destinationId?.message} required>
          {useCustom ? (
            <div className="flex gap-2">
              <input
                {...register('destinationId')}
                placeholder="e.g. Manali, Himachal Pradesh"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => { setUseCustom(false); setValue('destinationId', '') }}
                className="shrink-0 text-xs text-primary-600 hover:text-primary-700 underline"
              >
                Select existing
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select {...register('destinationId')} className="input flex-1">
                <option value="">Select destination</option>
                {destinations?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setUseCustom(true); setValue('destinationId', '') }}
                className="shrink-0 text-xs text-primary-600 hover:text-primary-700 underline"
              >
                Add new
              </button>
            </div>
          )}
        </FormField>

        <FormField label="Trip Type" error={errors.tripType?.message} required>
          <select {...register('tripType')} className="input">
            <option value="">Select type</option>
            {tripCategories?.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Booking Mode" error={errors.bookingMode?.message}>
        <div className="flex gap-4">
          {BOOKING_MODES.map((mode) => (
            <label key={mode.value} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
              <input
                type="radio"
                value={mode.value}
                {...register('bookingMode')}
                className="accent-primary-500"
              />
              {mode.label}
            </label>
          ))}
        </div>
      </FormField>

      <FormField label="Description" error={errors.description?.message} required>
        <textarea
          {...register('description')}
          rows={5}
          placeholder="Describe your trip — what makes it special?"
          className="input resize-y"
        />
      </FormField>
    </div>
  )
}
