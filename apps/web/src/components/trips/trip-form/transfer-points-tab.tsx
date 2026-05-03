'use client'

import { useFormContext, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, MapPin } from 'lucide-react'
import { FormField } from './form-field'
import type { CreateTripDto } from '@shared/types/trip.types'

const MAX_TRANSFER_POINTS = 10

const deleteButtonClass =
  'mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:border-error-300 hover:bg-error-50 hover:text-error-500 disabled:cursor-not-allowed disabled:opacity-30'

/** Transfer points tab — dynamic field arrays for pickup and drop points */
export function TransferPointsTab() {
  const { register, control, formState: { errors } } = useFormContext<CreateTripDto>()

  const {
    fields: pickupFields,
    append: addPickup,
    remove: removePickup,
  } = useFieldArray({ control, name: 'pickupPoints' })

  const {
    fields: dropFields,
    append: addDrop,
    remove: removeDrop,
  } = useFieldArray({ control, name: 'dropPoints' })

  return (
    <div className="space-y-8">
      {/* Pickup Points */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary-500" />
            <h3 className="text-base font-semibold text-neutral-800">Pickup Points</h3>
          </div>
          <button
            type="button"
            onClick={() => addPickup({ label: '', extraCharge: 0 })}
            disabled={pickupFields.length >= MAX_TRANSFER_POINTS}
            className="btn-ghost flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" /> Add Pickup
          </button>
        </div>
        {errors.pickupPoints?.message && (
          <p className="mb-3 text-sm text-error-500">{errors.pickupPoints.message}</p>
        )}
        <div className="space-y-3">
          {pickupFields.map((field, idx) => (
            <div key={field.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Label *" error={errors.pickupPoints?.[idx]?.label?.message}>
                  <input
                    {...register(`pickupPoints.${idx}.label`)}
                    placeholder="e.g. Delhi Airport T3"
                    className="input"
                  />
                </FormField>
                <FormField label="Address" error={errors.pickupPoints?.[idx]?.address?.message}>
                  <input
                    {...register(`pickupPoints.${idx}.address`)}
                    placeholder="Full address (optional)"
                    className="input"
                  />
                </FormField>
                <FormField label="Time" error={errors.pickupPoints?.[idx]?.time?.message}>
                  <input
                    {...register(`pickupPoints.${idx}.time`)}
                    placeholder="e.g. 06:00 AM"
                    className="input"
                  />
                </FormField>
                <div className="flex items-end gap-2">
                  <FormField label="Extra Charge (₹)" error={errors.pickupPoints?.[idx]?.extraCharge?.message}>
                    <input
                      type="number"
                      {...register(`pickupPoints.${idx}.extraCharge`, { valueAsNumber: true })}
                      placeholder="0"
                      className="input"
                    />
                  </FormField>
                  <button
                    type="button"
                    onClick={() => removePickup(idx)}
                    disabled={pickupFields.length <= 1}
                    className={deleteButtonClass}
                    title="Remove pickup point"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Drop Points */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-neutral-400" />
            <h3 className="text-base font-semibold text-neutral-800">Drop Points</h3>
          </div>
          <button
            type="button"
            onClick={() => addDrop({ label: '', extraCharge: 0 })}
            disabled={dropFields.length >= MAX_TRANSFER_POINTS}
            className="btn-ghost flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" /> Add Drop
          </button>
        </div>
        {errors.dropPoints?.message && (
          <p className="mb-3 text-sm text-error-500">{errors.dropPoints.message}</p>
        )}
        <div className="space-y-3">
          {dropFields.map((field, idx) => (
            <div key={field.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Label *" error={errors.dropPoints?.[idx]?.label?.message}>
                  <input
                    {...register(`dropPoints.${idx}.label`)}
                    placeholder="e.g. Delhi Airport T3"
                    className="input"
                  />
                </FormField>
                <FormField label="Address" error={errors.dropPoints?.[idx]?.address?.message}>
                  <input
                    {...register(`dropPoints.${idx}.address`)}
                    placeholder="Full address (optional)"
                    className="input"
                  />
                </FormField>
                <FormField label="Time" error={errors.dropPoints?.[idx]?.time?.message}>
                  <input
                    {...register(`dropPoints.${idx}.time`)}
                    placeholder="e.g. 08:00 PM"
                    className="input"
                  />
                </FormField>
                <div className="flex items-end gap-2">
                  <FormField label="Extra Charge (₹)" error={errors.dropPoints?.[idx]?.extraCharge?.message}>
                    <input
                      type="number"
                      {...register(`dropPoints.${idx}.extraCharge`, { valueAsNumber: true })}
                      placeholder="0"
                      className="input"
                    />
                  </FormField>
                  <button
                    type="button"
                    onClick={() => removeDrop(idx)}
                    disabled={dropFields.length <= 1}
                    className={deleteButtonClass}
                    title="Remove drop point"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
