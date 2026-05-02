'use client'

import { useFormContext } from 'react-hook-form'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { CreateTripDto } from '@shared/types/trip.types'

export function ReviewTab() {
  const { watch, formState: { errors } } = useFormContext<CreateTripDto>()
  const values = watch()

  const hasErrors = Object.keys(errors).length > 0

  return (
    <div className="space-y-6">
      {/* Validation status */}
      <div className={`flex items-center gap-3 rounded-lg p-4 ${hasErrors ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'}`}>
        {hasErrors ? (
          <>
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">
              Please fix {Object.keys(errors).length} validation error(s) before submitting.
            </p>
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">All fields are valid. Ready to create!</p>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="card-static divide-y divide-neutral-100">
        <SummaryRow label="Title" value={values.title || '—'} />
        <SummaryRow label="Type" value={values.tripType || '—'} />
        <SummaryRow label="Booking Mode" value={values.bookingMode || '—'} />
        <SummaryRow label="Start Date" value={values.startDate ? new Date(values.startDate).toLocaleDateString() : '—'} />
        <SummaryRow label="End Date" value={values.endDate ? new Date(values.endDate).toLocaleDateString() : '—'} />
        <SummaryRow label="Price / Person" value={values.pricePerPerson ? formatCurrency(values.pricePerPerson) : '—'} />
        <SummaryRow label="Group Size" value={`${values.minGroupSize || '?'} – ${values.maxGroupSize || '?'}`} />
        <SummaryRow label="Cancellation Policy" value={values.cancellationPolicy || '—'} />
        <SummaryRow label="Photos" value={`${(values.photos || []).length} uploaded`} />
        <SummaryRow label="Itinerary Days" value={`${(values.itinerary || []).length} days`} />
        {values.pickupLocation && <SummaryRow label="Pickup" value={`${values.pickupLocation} at ${values.pickupTime || '—'}`} />}
        {values.itineraryDocUrl && <SummaryRow label="Itinerary Doc" value="Linked" />}
      </div>

      {/* Description preview */}
      {values.description && (
        <div className="card-static p-4">
          <p className="mb-2 text-sm font-semibold text-neutral-700">Description Preview</p>
          <p className="text-sm text-neutral-600 whitespace-pre-wrap">{values.description}</p>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-800">{value}</span>
    </div>
  )
}
