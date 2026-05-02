'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createBookingSchema } from '@shared/validators/booking.schema'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency } from '@/lib/format'
import { getEffectivePrice } from '@/lib/trip-utils'
import type { TripDetail } from '@shared/types/trip.types'
import Link from 'next/link'

/** Form values extracted from the Zod schema */
export type TravelerFormValues = z.infer<typeof createBookingSchema>

/** Props for TravelerForm — numTravelers owned by parent page */
interface TravelerFormProps {
  trip: TripDetail
  numTravelers: number
  onNumTravelersChange: (count: number) => void
  onSubmit: (data: { travelers: TravelerFormValues['travelers'] }) => void
  isPending: boolean
}

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'] as const

export function TravelerForm({
  trip,
  numTravelers,
  onNumTravelersChange,
  onSubmit,
  isPending,
}: TravelerFormProps) {
  const user = useAuthStore((s) => s.user)
  const seatsLeft = Math.max(0, trip.maxGroupSize - trip.currentBookings)
  const maxTravelers = Math.min(seatsLeft, 10)

  // Restore form data from sessionStorage on refresh
  const storageKey = `booking-form-${trip.id}`
  function getSavedValues(): TravelerFormValues | null {
    if (typeof window === 'undefined') return null
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  }

  const saved = getSavedValues()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TravelerFormValues>({
    resolver: zodResolver(createBookingSchema),
    mode: 'onTouched',
    defaultValues: saved ?? {
      tripId: trip.id,
      numTravelers: 1,
      travelers: [
        {
          name: user?.name || '',
          phone: '',
          age: undefined as unknown as number,
          gender: 'MALE',
          isPrimary: true,
          emergencyContactName: '',
          emergencyContactPhone: '',
        },
      ],
    },
  })

  // Persist form data to sessionStorage on change (subscription — no re-renders)
  useEffect(() => {
    const subscription = watch((values) => {
      try { sessionStorage.setItem(storageKey, JSON.stringify(values)) } catch { /* quota */ }
    })
    return () => subscription.unsubscribe()
  }, [watch, storageKey])

  // Sync parent numTravelers from restored data on mount
  useEffect(() => {
    if (saved && saved.numTravelers !== numTravelers) {
      onNumTravelersChange(saved.numTravelers)
    }
  // eslint-disable-next-line -- run only on mount to sync restored numTravelers
  }, [])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'travelers',
  })

  function handleNumChange(newCount: number) {
    if (newCount < 1 || newCount > maxTravelers) return

    if (newCount > fields.length) {
      for (let i = fields.length; i < newCount; i++) {
        append({
          name: '',
          phone: '',
          age: undefined as unknown as number,
          gender: 'MALE',
          isPrimary: false,
          emergencyContactName: '',
          emergencyContactPhone: '',
        })
      }
    } else if (newCount < fields.length) {
      for (let i = fields.length - 1; i >= newCount; i--) {
        remove(i)
      }
    }

    setValue('numTravelers', newCount)
    onNumTravelersChange(newCount)
  }

  function onFormSubmit(data: TravelerFormValues) {
    // Clear persisted form on successful submit
    sessionStorage.removeItem(storageKey)
    onSubmit({ travelers: data.travelers })
  }

  const pricePerPerson = getEffectivePrice(trip)
  const totalPrice = pricePerPerson * numTravelers

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <input type="hidden" {...register('tripId')} />
      <input type="hidden" {...register('numTravelers', { valueAsNumber: true })} />

      {/* Number of travelers selector */}
      <div className="card p-4">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Number of Travelers
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNumChange(numTravelers - 1)}
            disabled={numTravelers <= 1}
            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-md"
            aria-label="Decrease travelers"
          >
            −
          </button>
          <span className="text-lg font-semibold w-8 text-center">{numTravelers}</span>
          <button
            type="button"
            onClick={() => handleNumChange(numTravelers + 1)}
            disabled={numTravelers >= maxTravelers}
            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-md"
            aria-label="Increase travelers"
          >
            +
          </button>
          <span className="text-sm text-neutral-500">
            ({seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left)
          </span>
        </div>
      </div>

      {/* Traveler fields */}
      {fields.map((field, index) => (
        <fieldset key={field.id} className="card p-4 space-y-4">
          <legend className="text-sm font-semibold text-neutral-700">
            <label htmlFor={`travelers.${index}.name`}>
              Traveler {index + 1} {index === 0 ? '(You)' : ''}
            </label>
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`travelers.${index}.name`} className="block text-xs font-medium text-neutral-600 mb-1">
                Name
              </label>
              <input
                id={`travelers.${index}.name`}
                {...register(`travelers.${index}.name`)}
                className="input w-full"
                placeholder="Full name"
                aria-label={index === 0 ? 'Name' : `Traveler ${index + 1} name`}
              />
              {errors.travelers?.[index]?.name && (
                <p className="text-xs text-error-500 mt-1">{errors.travelers[index]!.name!.message}</p>
              )}
            </div>

            <div>
              <label htmlFor={`travelers.${index}.phone`} className="block text-xs font-medium text-neutral-600 mb-1">
                Phone
              </label>
              <input
                id={`travelers.${index}.phone`}
                {...register(`travelers.${index}.phone`)}
                className="input w-full"
                placeholder="9876543210"
                aria-label={index === 0 ? 'Phone' : `Traveler ${index + 1} phone`}
              />
              {errors.travelers?.[index]?.phone && (
                <p className="text-xs text-error-500 mt-1">{errors.travelers[index]!.phone!.message}</p>
              )}
            </div>

            <div>
              <label htmlFor={`travelers.${index}.age`} className="block text-xs font-medium text-neutral-600 mb-1">
                Age
              </label>
              <input
                id={`travelers.${index}.age`}
                type="number"
                {...register(`travelers.${index}.age`, { valueAsNumber: true })}
                className="input w-full"
                placeholder="28"
                min={1}
                max={120}
                aria-label={index === 0 ? 'Age' : `Traveler ${index + 1} age`}
              />
              {errors.travelers?.[index]?.age && (
                <p className="text-xs text-error-500 mt-1">{errors.travelers[index]!.age!.message}</p>
              )}
            </div>

            <div>
              <label htmlFor={`travelers.${index}.gender`} className="block text-xs font-medium text-neutral-600 mb-1">
                Gender
              </label>
              <select
                id={`travelers.${index}.gender`}
                {...register(`travelers.${index}.gender`)}
                className="input w-full"
                aria-label={index === 0 ? 'Gender' : `Traveler ${index + 1} gender`}
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g.charAt(0) + g.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Emergency contact (optional) */}
          <details className="mt-2">
            <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-700">
              Emergency Contact (optional)
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label htmlFor={`travelers.${index}.emergencyContactName`} className="block text-xs font-medium text-neutral-600 mb-1">
                  Emergency Contact Name
                </label>
                <input
                  id={`travelers.${index}.emergencyContactName`}
                  {...register(`travelers.${index}.emergencyContactName`)}
                  className="input w-full"
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label htmlFor={`travelers.${index}.emergencyContactPhone`} className="block text-xs font-medium text-neutral-600 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  id={`travelers.${index}.emergencyContactPhone`}
                  {...register(`travelers.${index}.emergencyContactPhone`)}
                  className="input w-full"
                  placeholder="9876543210"
                />
              </div>
            </div>
          </details>
        </fieldset>
      ))}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing...
          </>
        ) : (
          `Pay ${formatCurrency(totalPrice)}`
        )}
      </button>

      {/* Legal text */}
      <p className="text-xs text-neutral-400 text-center mt-2">
        By booking, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-neutral-600">Terms</Link> &{' '}
        <Link href="/cancellation-policy" className="underline hover:text-neutral-600">Cancellation Policy</Link>.
      </p>
    </form>
  )
}
