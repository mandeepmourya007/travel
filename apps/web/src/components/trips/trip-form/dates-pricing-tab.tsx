'use client'

import { useFormContext, Controller } from 'react-hook-form'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FormField } from './form-field'
import { NumberInput } from '@/components/shared/number-input'
import { DateTimePicker } from '@/components/shared/date-time-picker'
import { formatCurrency } from '@/lib/format'
import type { CreateTripDto } from '@shared/types/trip.types'

const CANCELLATION_POLICIES = [
  { value: 'FLEXIBLE', label: 'Flexible — Full refund up to 7 days before' },
  { value: 'MODERATE', label: 'Moderate — Full refund up to 14 days before' },
  { value: 'STRICT', label: 'Strict — No refunds after booking' },
] as const

const MIN_TRAVELLER_PRICE = 100

/** gross = round(netEarning / (1 - commissionRate/100)) — proven round-trip safe with
 *  calculateOrganizerEntitlement's `round(gross * (1 - rate/100))` (see the plan's brute-force sweep).
 *  Exported so other trip-form tabs (e.g. review-tab.tsx) share this single implementation
 *  instead of reimplementing the formula inline and risking drift. */
export function computeGross(netEarning: number, commissionRate: number): number {
  return Math.round(netEarning / (1 - commissionRate / 100))
}

/** Reverse of computeGross — used to pre-fill "your earning" from an already-stored gross price. */
export function computeNet(gross: number, commissionRate: number): number {
  return Math.round(gross * (1 - commissionRate / 100))
}

interface DatesPricingTabProps {
  /** Percentage (e.g. 10 = 10%) used to convert "your earning" into the traveller-facing price. */
  commissionRate: number
}

export function DatesPricingTab({ commissionRate }: DatesPricingTabProps) {
  const { register, watch, control, setValue, formState: { errors } } = useFormContext<CreateTripDto>()
  const pricePerPerson = watch('pricePerPerson')
  const earlyBirdPriceGross = watch('earlyBirdPrice')
  const today = useMemo(() => new Date(), [])

  // The organizer types "their earning" (net) — RHF's `pricePerPerson`/`earlyBirdPrice`
  // fields hold the computed traveller-facing gross price and are never directly edited.
  const [earning, setEarning] = useState<string>(() =>
    pricePerPerson ? String(computeNet(pricePerPerson, commissionRate)) : '',
  )
  const [earlyBirdEarning, setEarlyBirdEarning] = useState<string>(() =>
    earlyBirdPriceGross ? String(computeNet(earlyBirdPriceGross, commissionRate)) : '',
  )
  const touchedEarning = useRef(false)
  const touchedEarlyBirdEarning = useRef(false)

  // Re-sync the earning display from a pre-filled gross value (edit mode / restored
  // draft) whenever the resolved commissionRate changes — e.g. it arrives late because
  // the organizer profile fetch was still in flight and we started on the fallback rate.
  // No-ops once the organizer has typed into the field themselves.
  useEffect(() => {
    if (touchedEarning.current) return
    if (pricePerPerson) setEarning(String(computeNet(pricePerPerson, commissionRate)))
  }, [commissionRate, pricePerPerson])

  useEffect(() => {
    if (touchedEarlyBirdEarning.current) return
    if (earlyBirdPriceGross) setEarlyBirdEarning(String(computeNet(earlyBirdPriceGross, commissionRate)))
  }, [commissionRate, earlyBirdPriceGross])

  // If the commissionRate changes AFTER the organizer already typed an earning figure
  // (late profile load), recompute the stored gross from that same typed figure so the
  // payload stays consistent with what's displayed.
  useEffect(() => {
    if (!touchedEarning.current || earning === '') return
    const net = Number(earning)
    if (!Number.isFinite(net)) return
    setValue('pricePerPerson', computeGross(net, commissionRate), { shouldValidate: true })
    // Deliberately depends only on commissionRate — `earning` is read fresh above but must
    // not itself retrigger this effect (that would fight with handleEarningChange while typing).
  }, [commissionRate])

  useEffect(() => {
    if (!touchedEarlyBirdEarning.current || earlyBirdEarning === '') return
    const net = Number(earlyBirdEarning)
    if (!Number.isFinite(net)) return
    setValue('earlyBirdPrice', computeGross(net, commissionRate), { shouldValidate: true })
  }, [commissionRate])

  const handleEarningChange = (val: string) => {
    touchedEarning.current = true
    setEarning(val)
    if (val === '') {
      setValue('pricePerPerson', undefined as unknown as number, { shouldValidate: true })
      return
    }
    const net = Number(val)
    if (!Number.isFinite(net)) return
    setValue('pricePerPerson', computeGross(net, commissionRate), { shouldValidate: true, shouldDirty: true })
  }

  const handleEarlyBirdEarningChange = (val: string) => {
    touchedEarlyBirdEarning.current = true
    setEarlyBirdEarning(val)
    if (val === '') {
      setValue('earlyBirdPrice', undefined, { shouldValidate: true })
      return
    }
    const net = Number(val)
    if (!Number.isFinite(net)) return
    setValue('earlyBirdPrice', computeGross(net, commissionRate), { shouldValidate: true, shouldDirty: true })
  }

  const earningNum = Number(earning)
  const grossPreview = earning !== '' && Number.isFinite(earningNum) ? computeGross(earningNum, commissionRate) : null
  const feePreview = grossPreview !== null ? grossPreview - earningNum : null
  const earningBelowMin = grossPreview !== null && grossPreview < MIN_TRAVELLER_PRICE

  const earlyBirdEarningNum = Number(earlyBirdEarning)
  const earlyBirdGrossPreview =
    earlyBirdEarning !== '' && Number.isFinite(earlyBirdEarningNum)
      ? computeGross(earlyBirdEarningNum, commissionRate)
      : null
  const earlyBirdFeePreview = earlyBirdGrossPreview !== null ? earlyBirdGrossPreview - earlyBirdEarningNum : null
  const earlyBirdBelowMin = earlyBirdGrossPreview !== null && earlyBirdGrossPreview < MIN_TRAVELLER_PRICE

  const earningError = earningBelowMin
    ? `This would result in a traveller price below ₹${MIN_TRAVELLER_PRICE} minimum`
    : errors.pricePerPerson
      ? 'Your earning per person is required'
      : undefined

  const earlyBirdEarningError = earlyBirdBelowMin
    ? `This would result in a traveller price below ₹${MIN_TRAVELLER_PRICE} minimum`
    : errors.earlyBirdPrice?.message

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Start Date" error={errors.startDate?.message} required>
          <Controller
            name="startDate"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick start date & time"
                minDate={today}
              />
            )}
          />
        </FormField>

        <FormField label="End Date" error={errors.endDate?.message} required>
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                placeholder="Pick end date & time"
                minDate={today}
              />
            )}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Min Group Size" error={errors.minGroupSize?.message} required>
          <Controller
            name="minGroupSize"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="minGroupSize"
                value={field.value?.toString() ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                onBlur={field.onBlur}
                ref={field.ref}
                placeholder="e.g. 5"
                min={1}
              />
            )}
          />
        </FormField>

        <FormField label="Max Group Size" error={errors.maxGroupSize?.message} required>
          <Controller
            name="maxGroupSize"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="maxGroupSize"
                value={field.value?.toString() ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                onBlur={field.onBlur}
                ref={field.ref}
                placeholder="e.g. 20"
                min={1}
              />
            )}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Your Earning Per Person (₹)" error={earningError} required>
          <NumberInput
            id="earning"
            value={earning}
            onChange={handleEarningChange}
            placeholder="e.g. 4050"
            min={0}
            inputClassName="font-mono"
          />
          {grossPreview !== null && !earningBelowMin && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Traveller pays <span className="font-semibold text-neutral-700">{formatCurrency(grossPreview)}</span>{' '}
              (includes platform fee {formatCurrency(feePreview!)} at {commissionRate}%)
            </p>
          )}
        </FormField>

        <FormField label="Your Earning — Early Bird (₹)" error={earlyBirdEarningError}>
          <NumberInput
            id="earlyBirdEarning"
            value={earlyBirdEarning}
            onChange={handleEarlyBirdEarningChange}
            placeholder="Optional"
            min={0}
            inputClassName="font-mono"
          />
          {earlyBirdGrossPreview !== null && !earlyBirdBelowMin && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Traveller pays{' '}
              <span className="font-semibold text-neutral-700">{formatCurrency(earlyBirdGrossPreview)}</span>{' '}
              (includes platform fee {formatCurrency(earlyBirdFeePreview!)} at {commissionRate}%)
            </p>
          )}
        </FormField>
      </div>

      {earlyBirdPriceGross && (
        <FormField label="Early Bird Deadline" error={errors.earlyBirdDeadline?.message}>
          <Controller
            name="earlyBirdDeadline"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                value={field.value ?? undefined}
                onChange={field.onChange}
                placeholder="Pick early bird deadline"
                minDate={today}
              />
            )}
          />
        </FormField>
      )}

      <FormField label="Booking Deadline" error={errors.bookingDeadline?.message}>
        <Controller
          name="bookingDeadline"
          control={control}
          render={({ field }) => (
            <DateTimePicker
              value={field.value ?? undefined}
              onChange={field.onChange}
              placeholder="Pick booking deadline"
              minDate={today}
            />
          )}
        />
      </FormField>

      <FormField label="Cancellation Policy" error={errors.cancellationPolicy?.message} required>
        <select {...register('cancellationPolicy')} className="input">
          {CANCELLATION_POLICIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </FormField>
    </div>
  )
}
