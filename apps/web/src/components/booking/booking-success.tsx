'use client'

import { CheckCircle, Shield } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDateRange } from '@/lib/format'

/** Props for the booking confirmation success screen */
interface BookingSuccessProps {
  bookingRef: string
  tripTitle: string
  tripDates: { start: string; end: string }
  numTravelers: number
  amountPaid: number
}

export function BookingSuccess({
  bookingRef,
  tripTitle,
  tripDates,
  numTravelers,
  amountPaid,
}: BookingSuccessProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-12 px-4">
      <div className="card p-8 space-y-6">
        {/* Success icon */}
        <CheckCircle className="h-16 w-16 text-success-500 mx-auto" />

        <h1 className="text-2xl font-display font-bold text-neutral-900">Booking Confirmed!</h1>

        {/* Booking details */}
        <div className="space-y-2 text-sm text-neutral-600">
          <p className="font-mono text-neutral-500">Booking ID: #{bookingRef}</p>
          <p className="font-semibold text-neutral-900">{tripTitle}</p>
          <p>{formatDateRange(tripDates.start, tripDates.end)}</p>
          <p>
            {numTravelers} traveler{numTravelers !== 1 ? 's' : ''} &middot;{' '}
            {formatCurrency(amountPaid)} paid
          </p>
        </div>

        {/* SafePay badge */}
        <div className="inline-flex items-center gap-2 bg-success-50 text-success-700 px-4 py-2 rounded-full text-sm">
          <Shield className="h-4 w-4" />
          Payment held safely via SafePay
        </div>

        {/* What's next */}
        <div className="text-left bg-neutral-50 rounded-lg p-4">
          <h2 className="font-display font-semibold text-sm text-neutral-900 mb-2">What&apos;s Next</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-600">
            <li>You&apos;ll receive a confirmation email shortly</li>
            <li>The organizer will share trip details before departure</li>
            <li>Your payment is safely held safely via SafePay until trip completion</li>
          </ol>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/my-bookings" prefetch={false} className="btn-primary">
            View My Bookings
          </Link>
          <button
            disabled
            className="btn-secondary opacity-50 cursor-not-allowed"
            title="Coming Soon"
          >
            Chat with Organizer
          </button>
        </div>
      </div>
    </div>
  )
}
