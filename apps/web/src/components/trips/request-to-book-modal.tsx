'use client'

import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/shared/modal'
import { useCreateTripRequest } from '@/hooks/use-create-trip-request'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { PhoneInput } from '@/components/shared/phone-input'
import { NumberInput } from '@/components/shared/number-input'
import { travelerDetailSchema } from '@shared/validators/booking.schema'

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'] as const

const requestFormSchema = z.object({
  message: z.string().max(500).optional().default(''),
  travelers: z.array(travelerDetailSchema).min(1),
})

type RequestFormValues = z.infer<typeof requestFormSchema>

interface RequestToBookModalProps {
  open: boolean
  onClose: () => void
  tripId: string
  tripTitle: string
  pricePerPerson: number
  seatsLeft: number
}

export function RequestToBookModal({
  open,
  onClose,
  tripId,
  tripTitle,
  pricePerPerson,
  seatsLeft,
}: RequestToBookModalProps) {
  const user = useAuthStore((s) => s.user)
  const createRequest = useCreateTripRequest()
  const maxTravelers = Math.min(10, seatsLeft)

  const { register, control, handleSubmit, formState: { errors }, watch } = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      message: '',
      travelers: [{ name: user?.name || '', phone: '', age: 0 as unknown as number, gender: 'MALE', isPrimary: true }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'travelers' })
  const numTravelers = fields.length

  const handleNumChange = (newCount: number) => {
    if (newCount > fields.length) {
      for (let i = fields.length; i < newCount; i++) {
        append({ name: '', phone: '', age: 0 as unknown as number, gender: 'MALE', isPrimary: false })
      }
    } else {
      for (let i = fields.length - 1; i >= newCount; i--) {
        remove(i)
      }
    }
  }

  const onSubmit = (data: RequestFormValues) => {
    createRequest.mutate(
      {
        tripId,
        numberOfTravelers: data.travelers.length,
        message: data.message?.trim() || undefined,
        travelers: data.travelers.map((t, i) => ({ ...t, isPrimary: i === 0 })),
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request to Book"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={createRequest.isPending || numTravelers < 1}
            className="btn-primary py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createRequest.isPending ? 'Sending...' : 'Send Request'}
          </button>
        </>
      }
    >
      {/* Trip info */}
      <div className="mb-4 rounded-lg bg-neutral-50 p-3">
        <p className="font-medium text-neutral-900">{tripTitle}</p>
        <p className="text-sm text-neutral-500">
          The organizer will review your request. If approved, you&apos;ll have 48 hours to pay.
        </p>
      </div>

      {/* Number of travelers */}
      <div className="mb-4">
        <label htmlFor="num-travelers" className="mb-1 block text-sm font-medium text-neutral-700">
          Number of travelers
        </label>
        <select
          id="num-travelers"
          value={numTravelers}
          onChange={(e) => handleNumChange(Number(e.target.value))}
          className="input"
        >
          {Array.from({ length: maxTravelers }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} traveler{n > 1 ? 's' : ''} — ₹{(pricePerPerson * n).toLocaleString('en-IN')}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-400">{seatsLeft} seats available</p>
      </div>

      {/* Traveler detail fields */}
      <div className="mb-4 space-y-3 max-h-[40vh] overflow-y-auto">
        {fields.map((field, i) => (
          <fieldset key={field.id} className="rounded-lg border border-neutral-200 p-3 space-y-2">
            <legend className="text-xs font-semibold text-neutral-600 px-1">
              Traveler {i + 1} {i === 0 ? '(You)' : ''}
            </legend>
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">Name</label>
                <input
                  {...register(`travelers.${i}.name`)}
                  placeholder="Full name"
                  className={cn('input w-full text-sm', errors.travelers?.[i]?.name && 'border-error-500')}
                />
                {errors.travelers?.[i]?.name && (
                  <p className="text-xs text-error-500">{errors.travelers[i]!.name!.message}</p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Controller
                  name={`travelers.${i}.phone`}
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      id={`request-travelers-${i}-phone`}
                      label="Phone"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      error={errors.travelers?.[i]?.phone?.message}
                    />
                  )}
                />
              </div>
              <div>
                <Controller
                  name={`travelers.${i}.age`}
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      id={`request-travelers-${i}-age`}
                      label="Age"
                      value={field.value?.toString() ?? ''}
                      onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      placeholder="Age"
                      min={1}
                      max={120}
                      error={errors.travelers?.[i]?.age?.message}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">Gender</label>
                <select
                  {...register(`travelers.${i}.gender`)}
                  className="input w-full text-sm"
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      {/* Message */}
      <div>
        <label htmlFor="request-message" className="mb-1 block text-sm font-medium text-neutral-700">
          Message to organizer <span className="text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="request-message"
          {...register('message')}
          placeholder="Tell the organizer about your group..."
          rows={3}
          maxLength={500}
          className="input resize-none"
        />
        <p className="mt-1 text-right text-xs text-neutral-400">{watch('message')?.length ?? 0}/500</p>
      </div>
    </Modal>
  )
}
