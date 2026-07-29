'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/shared/modal'
import { useSubmitOrganizerLead } from '@/hooks/use-organizer-lead'
import { cn } from '@/lib/utils'
import { createOrganizerLeadSchema } from '@shared/validators/organizer-lead.schema'
import type { CreateOrganizerLeadDto } from '@shared/types/organizer-lead.types'
import { APP_NAME } from '@/lib/constants'

interface OrganizerWaitlistModalProps {
  open: boolean
  onClose: () => void
}

type FormValues = CreateOrganizerLeadDto

export function OrganizerWaitlistModal({ open, onClose }: OrganizerWaitlistModalProps) {
  const submit = useSubmitOrganizerLead()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createOrganizerLeadSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      businessName: '',
      city: '',
      notes: '',
    },
  })

  // Reset form when the modal is re-opened so stale values don't leak in.
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const onSubmit = (values: FormValues) => {
    submit.mutate(values, {
      onSuccess: () => {
        reset()
        onClose()
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Join the organizer waitlist"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2.5 text-sm"
            disabled={submit.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={submit.isPending}
            className="btn-primary py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submit.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-neutral-500">
        Tell us about yourself and we&apos;ll reach out with next steps to list your trips on {APP_NAME}.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="lead-fullname" className="block text-sm font-medium text-neutral-700">
            Full name <span className="text-error-500">*</span>
          </label>
          <input
            id="lead-fullname"
            type="text"
            autoComplete="name"
            {...register('fullName')}
            placeholder="e.g. Amit Sharma"
            className={cn('input w-full text-sm', errors.fullName && 'border-error-500')}
          />
          {errors.fullName && (
            <p className="text-xs text-error-600">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lead-email" className="block text-sm font-medium text-neutral-700">
            Email <span className="text-error-500">*</span>
          </label>
          <input
            id="lead-email"
            type="email"
            autoComplete="email"
            {...register('email')}
            placeholder="you@example.com"
            className={cn('input w-full text-sm', errors.email && 'border-error-500')}
          />
          {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lead-phone" className="block text-sm font-medium text-neutral-700">
            Phone <span className="text-error-500">*</span>
          </label>
          <input
            id="lead-phone"
            type="tel"
            autoComplete="tel"
            {...register('phone')}
            placeholder="+919876543210"
            className={cn('input w-full text-sm', errors.phone && 'border-error-500')}
          />
          <p className="text-xs text-neutral-400">Include country code, e.g. +91 for India.</p>
          {errors.phone && <p className="text-xs text-error-600">{errors.phone.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="lead-business" className="block text-sm font-medium text-neutral-700">
              Business / brand <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              id="lead-business"
              type="text"
              {...register('businessName')}
              placeholder="Wanderlust Tours"
              className={cn('input w-full text-sm', errors.businessName && 'border-error-500')}
            />
            {errors.businessName && (
              <p className="text-xs text-error-600">{errors.businessName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-city" className="block text-sm font-medium text-neutral-700">
              City <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              id="lead-city"
              type="text"
              autoComplete="address-level2"
              {...register('city')}
              placeholder="Mumbai"
              className={cn('input w-full text-sm', errors.city && 'border-error-500')}
            />
            {errors.city && <p className="text-xs text-error-600">{errors.city.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lead-notes" className="block text-sm font-medium text-neutral-700">
            Anything else? <span className="text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="lead-notes"
            {...register('notes')}
            rows={3}
            maxLength={500}
            placeholder="What kind of trips do you organize? How many per year?"
            className={cn('input w-full resize-none text-sm', errors.notes && 'border-error-500')}
          />
          {errors.notes && <p className="text-xs text-error-600">{errors.notes.message}</p>}
        </div>
      </form>
    </Modal>
  )
}
