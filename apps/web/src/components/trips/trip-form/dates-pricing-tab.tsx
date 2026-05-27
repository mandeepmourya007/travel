'use client'

import { useFormContext, Controller } from 'react-hook-form'
import { useMemo } from 'react'
import { FormField } from './form-field'
import { NumberInput } from '@/components/shared/number-input'
import { DateTimePicker } from '@/components/shared/date-time-picker'
import type { CreateTripDto } from '@shared/types/trip.types'

const CANCELLATION_POLICIES = [
  { value: 'FLEXIBLE', label: 'Flexible — Full refund up to 7 days before' },
  { value: 'MODERATE', label: 'Moderate — Full refund up to 14 days before' },
  { value: 'STRICT', label: 'Strict — No refunds after booking' },
] as const

export function DatesPricingTab() {
  const { register, watch, control, formState: { errors } } = useFormContext<CreateTripDto>()
  const earlyBirdPrice = watch('earlyBirdPrice')
  const today = useMemo(() => new Date(), [])

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
        <FormField label="Price Per Person (₹)" error={errors.pricePerPerson?.message} required>
          <Controller
            name="pricePerPerson"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="pricePerPerson"
                value={field.value?.toString() ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                onBlur={field.onBlur}
                ref={field.ref}
                placeholder="e.g. 4500"
                min={0}
                inputClassName="font-mono"
              />
            )}
          />
        </FormField>

        <FormField label="Early Bird Price (₹)" error={errors.earlyBirdPrice?.message}>
          <Controller
            name="earlyBirdPrice"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="earlyBirdPrice"
                value={field.value?.toString() ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                onBlur={field.onBlur}
                ref={field.ref}
                placeholder="Optional"
                min={0}
                inputClassName="font-mono"
              />
            )}
          />
        </FormField>
      </div>

      {earlyBirdPrice && (
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
