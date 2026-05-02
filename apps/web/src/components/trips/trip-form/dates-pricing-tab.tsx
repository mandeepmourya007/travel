'use client'

import { useFormContext } from 'react-hook-form'
import { FormField } from './form-field'
import type { CreateTripDto } from '@shared/types/trip.types'

const CANCELLATION_POLICIES = [
  { value: 'FLEXIBLE', label: 'Flexible — Full refund up to 7 days before' },
  { value: 'MODERATE', label: 'Moderate — Full refund up to 14 days before' },
  { value: 'STRICT', label: 'Strict — No refunds after booking' },
] as const

export function DatesPricingTab() {
  const { register, watch, formState: { errors } } = useFormContext<CreateTripDto>()
  const earlyBirdPrice = watch('earlyBirdPrice')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Start Date" error={errors.startDate?.message} required>
          <input type="datetime-local" {...register('startDate')} className="input" />
        </FormField>

        <FormField label="End Date" error={errors.endDate?.message} required>
          <input type="datetime-local" {...register('endDate')} className="input" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Min Group Size" error={errors.minGroupSize?.message} required>
          <input
            type="number"
            {...register('minGroupSize', { valueAsNumber: true })}
            placeholder="e.g. 5"
            className="input"
          />
        </FormField>

        <FormField label="Max Group Size" error={errors.maxGroupSize?.message} required>
          <input
            type="number"
            {...register('maxGroupSize', { valueAsNumber: true })}
            placeholder="e.g. 20"
            className="input"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Price Per Person (₹)" error={errors.pricePerPerson?.message} required>
          <input
            type="number"
            {...register('pricePerPerson', { valueAsNumber: true })}
            placeholder="e.g. 4500"
            className="input font-mono"
          />
        </FormField>

        <FormField label="Early Bird Price (₹)" error={errors.earlyBirdPrice?.message}>
          <input
            type="number"
            {...register('earlyBirdPrice', { valueAsNumber: true })}
            placeholder="Optional"
            className="input font-mono"
          />
        </FormField>
      </div>

      {earlyBirdPrice && (
        <FormField label="Early Bird Deadline" error={errors.earlyBirdDeadline?.message}>
          <input type="datetime-local" {...register('earlyBirdDeadline')} className="input" />
        </FormField>
      )}

      <FormField label="Booking Deadline" error={errors.bookingDeadline?.message}>
        <input type="datetime-local" {...register('bookingDeadline')} className="input" />
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
