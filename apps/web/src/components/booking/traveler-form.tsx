'use client'

// [TravelerDetail] import { useEffect } from 'react'
// [TravelerDetail] import { useForm, useFieldArray, Controller } from 'react-hook-form'
// [TravelerDetail] import { zodResolver } from '@hookform/resolvers/zod'
// [TravelerDetail] import { z } from 'zod'
// [TravelerDetail] import { createBookingSchema } from '@shared/validators/booking.schema'
// [TravelerDetail] import { useAuthStore } from '@/store/auth.store'
// [TravelerDetail] import { PhoneInput } from '@/components/shared/phone-input'
// [TravelerDetail] import { NumberInput } from '@/components/shared/number-input'
import { MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { getEffectivePrice } from '@/lib/trip-utils'
import type { TripDetail } from '@shared/types/trip.types'
import Link from 'next/link'

// [TravelerDetail] export type TravelerFormValues = z.infer<typeof createBookingSchema>

interface TravelerFormProps {
  trip: TripDetail
  numTravelers: number
  onNumTravelersChange: (count: number) => void
  pickupPointId: string | undefined
  dropPointId: string | undefined
  onPickupChange: (id: string | undefined) => void
  onDropChange: (id: string | undefined) => void
  transferExtra: number
  // [TravelerDetail] onSubmit: (data: { travelers: TravelerFormValues['travelers']; pickupPointId?: string; dropPointId?: string }) => void
  onSubmit: () => void
  isPending: boolean
  lockedTravelers?: boolean
  /** Reseller sublink markup, per person */
  markupAmount?: number
}

export function TravelerForm({
  trip,
  numTravelers,
  onNumTravelersChange,
  pickupPointId,
  dropPointId,
  onPickupChange,
  onDropChange,
  transferExtra,
  onSubmit,
  isPending,
  lockedTravelers = false,
  markupAmount = 0,
}: TravelerFormProps) {
  const seatsLeft = Math.max(0, trip.maxGroupSize - trip.currentBookings)
  const maxTravelers = Math.min(seatsLeft, 10)

  // [TravelerDetail] const user = useAuthStore((s) => s.user)
  // [TravelerDetail] const storageKey = `booking-form-${trip.id}`
  // [TravelerDetail] const saved = (() => { try { const r = sessionStorage.getItem(storageKey); return r ? JSON.parse(r) : null } catch { return null } })()
  // [TravelerDetail] const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<TravelerFormValues>({
  // [TravelerDetail]   resolver: zodResolver(createBookingSchema), mode: 'onTouched',
  // [TravelerDetail]   defaultValues: saved ?? { tripId: trip.id, numTravelers: 1,
  // [TravelerDetail]     pickupPointId: trip.pickupPoints?.[0]?.id ?? undefined,
  // [TravelerDetail]     dropPointId: trip.dropPoints?.[0]?.id ?? undefined,
  // [TravelerDetail]     travelers: [{ name: user?.name || '', phone: '', age: undefined as unknown as number, gender: 'MALE', isPrimary: true, emergencyContactName: '', emergencyContactPhone: '' }] }
  // [TravelerDetail] })
  // [TravelerDetail] useEffect(() => { const sub = watch((v) => { try { sessionStorage.setItem(storageKey, JSON.stringify(v)) } catch {} }); return () => sub.unsubscribe() }, [watch, storageKey])
  // [TravelerDetail] useEffect(() => { if (lockedTravelers) { handleNumChange(numTravelers) } else if (saved && saved.numTravelers !== numTravelers) { onNumTravelersChange(saved.numTravelers) } }, [])
  // [TravelerDetail] const { fields, append, remove } = useFieldArray({ control, name: 'travelers' })

  function handleNumChange(newCount: number) {
    if (newCount < 1 || newCount > maxTravelers) return
    // [TravelerDetail] if (newCount > fields.length) { for (let i = fields.length; i < newCount; i++) { append({ name: '', phone: '', age: undefined as unknown as number, gender: 'MALE', isPrimary: false, emergencyContactName: '', emergencyContactPhone: '' }) } }
    // [TravelerDetail] else if (newCount < fields.length) { for (let i = fields.length - 1; i >= newCount; i--) { remove(i) } }
    // [TravelerDetail] setValue('numTravelers', newCount)
    onNumTravelersChange(newCount)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  const totalPrice = (getEffectivePrice(trip) + markupAmount + transferExtra) * numTravelers

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Number of travelers selector */}
      <div className="card p-4">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Number of Travelers
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNumChange(numTravelers - 1)}
            disabled={lockedTravelers || numTravelers <= 1}
            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-md"
            aria-label="Decrease travelers"
          >
            −
          </button>
          <span className="text-lg font-semibold w-8 text-center">{numTravelers}</span>
          <button
            type="button"
            onClick={() => handleNumChange(numTravelers + 1)}
            disabled={lockedTravelers || numTravelers >= maxTravelers}
            className="btn-secondary h-9 w-9 flex items-center justify-center rounded-md"
            aria-label="Increase travelers"
          >
            +
          </button>
          <span className="text-sm text-neutral-500">
            ({seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left)
          </span>
        </div>
        {lockedTravelers && (
          <p className="text-xs text-neutral-400 mt-2">
            Traveler count is locked to your approved request.
          </p>
        )}
      </div>

      {/* Pickup & Drop Point Selectors */}
      {(trip.pickupPoints?.length > 0 || trip.dropPoints?.length > 0) && (
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary-500" /> Transfer Points
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trip.pickupPoints?.length > 0 && (
              <div>
                <label htmlFor="pickupPointId" className="block text-xs font-medium text-neutral-600 mb-1">
                  Pickup Point
                </label>
                <select
                  id="pickupPointId"
                  className="input w-full"
                  value={pickupPointId ?? ''}
                  onChange={(e) => onPickupChange(e.target.value || undefined)}
                >
                  {trip.pickupPoints.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.time ? ` · ${p.time}` : ''}{p.extraCharge > 0 ? ` (+${formatCurrency(p.extraCharge)})` : ' · No charges'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {trip.dropPoints?.length > 0 && (
              <div>
                <label htmlFor="dropPointId" className="block text-xs font-medium text-neutral-600 mb-1">
                  Drop Point
                </label>
                <select
                  id="dropPointId"
                  className="input w-full"
                  value={dropPointId ?? ''}
                  onChange={(e) => onDropChange(e.target.value || undefined)}
                >
                  {trip.dropPoints.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.time ? ` · ${p.time}` : ''}{p.extraCharge > 0 ? ` (+${formatCurrency(p.extraCharge)})` : ' · No charges'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* [TravelerDetail] Per-traveler detail fieldsets — uncomment to restore
      {fields.map((field, index) => (
        <fieldset key={field.id} className="card p-4 space-y-4">
          <legend className="text-sm font-semibold text-neutral-700">
            <label htmlFor={`travelers.${index}.name`}>Traveler {index + 1} {index === 0 ? '(You)' : ''}</label>
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`travelers.${index}.name`} className="block text-xs font-medium text-neutral-600 mb-1">Name</label>
              <input id={`travelers.${index}.name`} {...register(`travelers.${index}.name`)} className="input w-full" placeholder="Full name" />
              {errors.travelers?.[index]?.name && <p className="text-xs text-error-500 mt-1">{errors.travelers[index]!.name!.message}</p>}
            </div>
            <Controller name={`travelers.${index}.phone`} control={control} render={({ field }) => (
              <PhoneInput id={`travelers-${index}-phone`} label="Phone" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} error={errors.travelers?.[index]?.phone?.message} />
            )} />
            <Controller name={`travelers.${index}.age`} control={control} render={({ field }) => (
              <NumberInput id={`travelers-${index}-age`} label="Age" value={field.value?.toString() ?? ''} onChange={(val) => field.onChange(val === '' ? undefined : Number(val))} onBlur={field.onBlur} ref={field.ref} placeholder="28" min={1} max={120} error={errors.travelers?.[index]?.age?.message} />
            )} />
            <div>
              <label htmlFor={`travelers.${index}.gender`} className="block text-xs font-medium text-neutral-600 mb-1">Gender</label>
              <select id={`travelers.${index}.gender`} {...register(`travelers.${index}.gender`)} className="input w-full">
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          <details className="mt-2">
            <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-700">Emergency Contact (optional)</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label htmlFor={`travelers.${index}.emergencyContactName`} className="block text-xs font-medium text-neutral-600 mb-1">Emergency Contact Name</label>
                <input id={`travelers.${index}.emergencyContactName`} {...register(`travelers.${index}.emergencyContactName`)} className="input w-full" placeholder="Contact name" />
              </div>
              <Controller name={`travelers.${index}.emergencyContactPhone`} control={control} render={({ field }) => (
                <PhoneInput id={`travelers-${index}-emergencyPhone`} label="Emergency Contact Phone" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
              )} />
            </div>
          </details>
        </fieldset>
      ))}
      [TravelerDetail] */}

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
        <Link href="/terms" prefetch={false} className="underline hover:text-neutral-600">Terms of Service</Link>,{' '}
        <Link href="/cancellation-policy" prefetch={false} className="underline hover:text-neutral-600">Cancellation Policy</Link>, and{' '}
        <Link href="/rules" prefetch={false} className="underline hover:text-neutral-600">Community Rules</Link>.
      </p>
    </form>
  )
}
