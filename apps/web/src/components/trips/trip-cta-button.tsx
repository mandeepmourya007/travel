'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, CreditCard, AlertTriangle } from 'lucide-react'
import { getSeatsLeft } from '@/lib/format'
import { useAuthStore } from '@/store/auth.store'
import { useMyTripBookingStatus } from '@/hooks/use-my-trip-booking-status'
import { RequestToBookModal } from './request-to-book-modal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { TripDetail } from '@shared/types/trip.types'
import { USER_ROLE, BOOKING_STATUS } from '@shared/constants'

interface TripCtaButtonProps {
  trip: TripDetail
  variant?: 'card' | 'bar'
}

export function TripCtaButton({ trip, variant = 'card' }: TripCtaButtonProps) {
  const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
  const isFull = seatsLeft === 0
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showOrganizerError, setShowOrganizerError] = useState(false)
  const { data: tripStatus } = useMyTripBookingStatus(trip.id)
  const currentUser = useAuthStore((s) => s.user)

  const isOrganizer = currentUser?.role === USER_ROLE.ORGANIZER

  const isCard = variant === 'card'

  const disabledCls = isCard
    ? 'btn-disabled w-full text-center flex items-center justify-center gap-2'
    : 'btn-disabled px-5 py-2.5 text-sm flex items-center gap-2'

  const accentCls = isCard
    ? 'btn-accent w-full text-center flex items-center justify-center gap-2'
    : 'btn-accent px-5 py-2.5 text-sm flex items-center gap-2'

  const primaryCls = isCard
    ? 'btn-primary w-full text-center'
    : 'btn-primary px-5 py-2.5 text-sm'

  const handleOrganizerClick = () => setShowOrganizerError(true)

  return (
    <>
      {tripStatus?.bookingStatus === BOOKING_STATUS.CONFIRMED ? (
        isOrganizer ? (
          <button type="button" onClick={handleOrganizerClick} className={primaryCls}>
            Book Again
          </button>
        ) : trip.bookingMode === 'INSTANT' ? (
          <Link href={`/trips/${trip.slug}/book`} prefetch={false} className={primaryCls}>
            Book Again
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowRequestModal(true)}
            className={primaryCls}
          >
            Book Again
          </button>
        )
      ) : tripStatus?.bookingStatus === 'PENDING_PAYMENT' ? (
        isOrganizer ? (
          <button type="button" onClick={handleOrganizerClick} className={accentCls}>
            <CreditCard className="h-4 w-4" /> Complete Payment
          </button>
        ) : (
          <Link href={`/trips/${trip.slug}/book`} prefetch={false} className={accentCls}>
            <CreditCard className="h-4 w-4" /> Complete Payment
          </Link>
        )
      ) : tripStatus?.requestStatus === 'PENDING' ? (
        <button disabled className={disabledCls}>
          <Clock className="h-4 w-4" /> Request Sent
        </button>
      ) : tripStatus?.requestStatus === 'APPROVED' ? (
        isOrganizer ? (
          <button type="button" onClick={handleOrganizerClick} className={accentCls}>
            <CreditCard className="h-4 w-4" /> Pay Now
          </button>
        ) : (
          <Link href={`/trips/${trip.slug}/book`} prefetch={false} className={accentCls}>
            <CreditCard className="h-4 w-4" /> Pay Now
          </Link>
        )
      ) : !trip.acceptingBookings ? (
        <div className={isCard ? 'space-y-1 w-full' : 'space-y-1'}>
          <button disabled className={isCard ? 'btn-disabled w-full text-center' : 'btn-disabled px-5 py-2.5 text-sm'}>
            Bookings Closed
          </button>
          {trip.bookingsPausedReason && (
            <p className="text-xs text-neutral-500 text-center px-1">{trip.bookingsPausedReason}</p>
          )}
        </div>
      ) : isFull ? (
        <button disabled className={isCard ? 'btn-disabled w-full text-center' : 'btn-disabled px-5 py-2.5 text-sm'}>
          Fully Booked
        </button>
      ) : isOrganizer ? (
        <button type="button" onClick={handleOrganizerClick} className={primaryCls}>
          {trip.bookingMode === 'INSTANT' ? 'Book Now' : 'Request to Book'}
        </button>
      ) : trip.bookingMode === 'INSTANT' ? (
        <Link href={`/trips/${trip.slug}/book`} prefetch={false} className={primaryCls}>
          Book Now
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setShowRequestModal(true)}
          className={primaryCls}
        >
          Request to Book
        </button>
      )}

      {showRequestModal && (
        <RequestToBookModal
          open={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          tripId={trip.id}
          tripTitle={trip.title}
          pricePerPerson={trip.pricePerPerson}
          seatsLeft={seatsLeft}
        />
      )}

      <Dialog open={showOrganizerError} onOpenChange={setShowOrganizerError}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-50">
              <AlertTriangle className="h-6 w-6 text-error-500" />
            </div>
            <DialogTitle className="text-center">Booking Not Allowed</DialogTitle>
            <DialogDescription className="text-center">
              Organizer accounts cannot book trips. Please sign in with a traveler account to make a booking.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <button
              type="button"
              onClick={() => setShowOrganizerError(false)}
              className="btn-primary px-6"
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
