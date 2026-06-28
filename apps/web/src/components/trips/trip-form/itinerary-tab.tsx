'use client'

import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { FormField } from './form-field'
import { TimePicker } from '@/components/shared/time-picker'
import type { CreateTripDto } from '@shared/types/trip.types'

export function ItineraryTab() {
  const { register, control, formState: { errors } } = useFormContext<CreateTripDto>()

  const { fields: days, append: addDay, remove: removeDay } = useFieldArray({
    control,
    name: 'itinerary',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-800">Day-by-Day Itinerary</h3>
          <p className="text-sm text-neutral-500">Add activities for each day of the trip.</p>
        </div>
        <button
          type="button"
          onClick={() => addDay({ day: days.length + 1, title: '', description: '', activities: [] })}
          className="btn-outline flex shrink-0 items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Day
        </button>
      </div>

      {days.length === 0 && (
        <div className="card-static p-8 text-center">
          <p className="text-sm text-neutral-500">No days added yet. Click &quot;Add Day&quot; to start building your itinerary.</p>
        </div>
      )}

      <div className="space-y-4">
        {days.map((day, index) => (
          <ItineraryDayCard
            key={day.id}
            index={index}
            onRemove={() => removeDay(index)}
            register={register}
            control={control}
            errors={errors}
          />
        ))}
      </div>

      {/* Inclusions / Exclusions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <FormField label="Inclusions" error={errors.inclusions?.message}>
          <textarea
            {...register('inclusions')}
            rows={3}
            placeholder="Breakfast, AC Transport, Stay (one per line)"
            className="input resize-y text-sm"
          />
        </FormField>

        <FormField label="Exclusions" error={errors.exclusions?.message}>
          <textarea
            {...register('exclusions')}
            rows={3}
            placeholder="Lunch, Personal expenses (one per line)"
            className="input resize-y text-sm"
          />
        </FormField>
      </div>
    </div>
  )
}

interface ItineraryDayCardProps {
  index: number
  onRemove: () => void
  register: ReturnType<typeof useFormContext<CreateTripDto>>['register']
  control: ReturnType<typeof useFormContext<CreateTripDto>>['control']
  errors: ReturnType<typeof useFormContext<CreateTripDto>>['formState']['errors']
}


function ItineraryDayCard({ index, onRemove, register, control, errors: _errors }: ItineraryDayCardProps) {
  const { fields: activities, append: addActivity, remove: removeActivity } = useFieldArray({
    control,
    name: `itinerary.${index}.activities`,
  })

  return (
    <div className="card-static p-4">
      <div className="flex items-center gap-3">
        <GripVertical className="hidden sm:block h-4 w-4 text-neutral-300 shrink-0" />
        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
          {index + 1}
        </span>
        <input
          {...register(`itinerary.${index}.title`)}
          placeholder={`Day ${index + 1} title`}
          className="input flex-1 py-2"
        />
        <button type="button" onClick={onRemove} className="btn-ghost p-1.5 text-neutral-400 hover:text-error-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 pl-0 sm:pl-14">
        <textarea
          {...register(`itinerary.${index}.description`)}
          rows={4}
          placeholder="Day description..."
          className="input resize-y text-sm"
        />

        {/* Activities */}
        <div className="mt-3 space-y-2">
          {activities.map((activity, actIdx) => (
            <div
              key={activity.id}
              className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-2.5 sm:border-0 sm:bg-transparent sm:p-0"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1.5">
                {/* Time row (mobile) / left slot (desktop) */}
                <div className="flex items-center gap-1.5">
                  <Controller
                    name={`itinerary.${index}.activities.${actIdx}.time`}
                    control={control}
                    render={({ field }) => (
                      <TimePicker
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        placeholder="Time"
                        className="w-full py-1.5 text-sm sm:w-36"
                      />
                    )}
                  />
                  {/* Delete — visible only on mobile, sits at end of time row */}
                  <button
                    type="button"
                    onClick={() => removeActivity(actIdx)}
                    className="btn-ghost ml-auto shrink-0 p-1 text-neutral-400 hover:text-error-500 sm:hidden"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Activity title — full width on mobile, flex-1 on desktop */}
                <input
                  {...register(`itinerary.${index}.activities.${actIdx}.title`)}
                  placeholder="Activity"
                  className="input min-w-0 flex-1 py-1.5 text-sm"
                />

                {/* Delete — visible only on desktop, sits at end of inline row */}
                <button
                  type="button"
                  onClick={() => removeActivity(actIdx)}
                  className="btn-ghost hidden shrink-0 p-1 text-neutral-400 hover:text-error-500 sm:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addActivity({ title: '', time: undefined })}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            + Add Activity
          </button>
        </div>
      </div>
    </div>
  )
}
