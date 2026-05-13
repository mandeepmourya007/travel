'use client'

import { useState, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { useDestinations } from '@/hooks/use-destinations'
import { useTripCategories, useSubmitTripTypeRequest } from '@/hooks/use-trip-categories'
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
          <RequestTripTypeLink />
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

// ─── Inline request form ─────────────────────────────

function RequestTripTypeLink() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const mutation = useSubmitTripTypeRequest()

  const handleSubmit = async () => {
    if (!name.trim() || !reason.trim()) return
    await mutation.mutateAsync({ suggestedName: name.trim(), reason: reason.trim() })
    setName('')
    setReason('')
    setOpen(false)
    mutation.reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs text-primary-600 hover:text-primary-700 underline"
      >
        Don&apos;t see your type? Request one
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-primary-200 bg-primary-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-neutral-700">Request a new trip type</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Trip type name (e.g. Camping)"
        className="input text-sm"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why do you need this type?"
        rows={2}
        className="input text-sm resize-none"
      />
      {mutation.isSuccess && (
        <p className="text-xs text-success-500">Request submitted! Admin will review it.</p>
      )}
      {mutation.isError && (
        <p className="text-xs text-error-500">
          {(mutation.error as Error)?.message || 'Failed to submit'}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending || !name.trim() || !reason.trim()}
          className="btn-primary text-xs"
        >
          {mutation.isPending ? 'Submitting...' : 'Submit Request'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); mutation.reset() }}
          className="btn-outline text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
