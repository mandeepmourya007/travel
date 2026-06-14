'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { MyBookingListItem } from '@shared/types/booking.types'
import { estimateRefund } from '@shared/utils/refund'
import { useCancelBooking } from '@/hooks/use-cancel-booking'

interface CancelBookingModalProps {
  booking: MyBookingListItem
  onClose: () => void
}

export function CancelBookingModal({ booking, onClose }: CancelBookingModalProps) {
  const [reason, setReason] = useState('')
  const cancelMutation = useCancelBooking()
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus trap — focus modal on mount
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  const isReasonValid = reason.trim().length >= 5
  const showValidation = reason.length > 0 && !isReasonValid
  const refundEstimate = estimateRefund(booking.totalAmount, booking.trip.cancellationPolicy, booking.trip.startDate)

  const handleConfirm = () => {
    if (!isReasonValid) return
    cancelMutation.mutate(
      { bookingId: booking.id, reason: reason.trim() },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      {/* Modal — mobile: bottom sheet, desktop: centered card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full rounded-t-2xl bg-white p-5 shadow-xl md:mx-4 md:max-w-md md:rounded-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Cancel Booking</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Booking info */}
        <div className="mb-4 rounded-lg bg-neutral-50 p-3">
          <p className="font-medium text-neutral-900">{booking.trip.title}</p>
          <p className="text-sm text-neutral-500">Booking #{booking.bookingRef}</p>
        </div>

        {/* Policy + refund info */}
        <div className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Cancellation Policy</span>
            <span className="font-medium">{booking.trip.cancellationPolicy}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Amount Paid</span>
            <span className="font-medium">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between rounded-md bg-neutral-100 px-2 py-1.5">
            <span className="font-medium text-neutral-700">Estimated Refund</span>
            <span className={`font-semibold ${refundEstimate.amount > 0 ? 'text-success-500' : 'text-error-500'}`}>
              {refundEstimate.amount > 0
                ? `₹${refundEstimate.amount.toLocaleString('en-IN')} (${refundEstimate.percent}%)`
                : 'No refund'}
            </span>
          </div>
        </div>

        {/* Reason textarea */}
        <div className="mb-4">
          <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium text-neutral-700">
            Reason for cancellation
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please tell us why you're cancelling..."
            rows={3}
            className="input resize-none"
          />
          {showValidation && (
            <p className="mt-1 text-xs text-error-500">Reason must be at least 5 characters</p>
          )}
        </div>

        {/* Buttons — mobile: stacked full-width, desktop: side-by-side */}
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors md:flex-1"
          >
            Keep Booking
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isReasonValid || cancelMutation.isPending}
            className="w-full rounded-lg bg-error-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors md:flex-1"
          >
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel & Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}
