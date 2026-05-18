'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, Users, Star, Pencil } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import type { MyBookingListItem } from '@shared/types/booking.types'
import { formatCurrency, formatDateRange, formatDateFull } from '@/lib/format'
import { BookingStatusBadge } from './booking-status-badge'
import { TravelerDetailsAccordion } from './traveler-details-accordion'

interface MyBookingCardProps {
  booking: MyBookingListItem
  onCancel?: (booking: MyBookingListItem) => void
  onReview?: (booking: MyBookingListItem) => void
}

function getCountdown(startDate: string): string | null {
  const ms = new Date(startDate).getTime() - Date.now()
  if (ms <= 0) return null
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  return `Starts in ${days} day${days === 1 ? '' : 's'}`
}

function canCancel(booking: MyBookingListItem): boolean {
  if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.bookingStatus)) return false
  return new Date(booking.trip.startDate).getTime() > Date.now()
}

export function MyBookingCard({ booking, onCancel, onReview }: MyBookingCardProps) {
  const { trip } = booking
  const countdown = getCountdown(trip.startDate)
  const showCancel = canCancel(booking)
  const showLeaveReview = booking.bookingStatus === 'COMPLETED' && !booking.hasReview
  const showEditReview = booking.bookingStatus === 'COMPLETED' && booking.hasReview

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md md:flex-row md:gap-4 md:p-4">
      {/* Trip photo — mobile: full width, desktop: fixed sidebar */}
      <Link
        href={`/trips/${trip.slug}`}
        prefetch={false}
        className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 md:h-auto md:w-40"
      >
        {trip.photos[0] && (
          <Image
            src={trip.photos[0]}
            alt={trip.title}
            fill
            sizes="(max-width: 768px) 100vw, 160px"
            className="object-cover"
          />
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between gap-2">
        {/* Title + status — mobile: stack, desktop: row */}
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-2">
          <Link href={`/trips/${trip.slug}`} prefetch={false} className="text-base font-semibold text-neutral-900 hover:text-primary-600 md:text-lg">
            {trip.title}
          </Link>
          <BookingStatusBadge status={booking.bookingStatus} className="self-start" />
        </div>

        {/* Meta — wraps naturally on mobile */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {trip.destination.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {booking.numTravelers} traveler{booking.numTravelers === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-neutral-400">
            by {trip.organizer.businessName}
            {trip.organizer.verified && <span className="ml-0.5 text-green-500">✓</span>}
          </span>
          {booking.pickupPoint && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
              Pickup: {booking.pickupPoint.label}{booking.pickupPoint.time ? ` · ${booking.pickupPoint.time}` : ''}
            </span>
          )}
          {booking.dropPoint && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
              Drop: {booking.dropPoint.label}{booking.dropPoint.time ? ` · ${booking.dropPoint.time}` : ''}
            </span>
          )}
        </div>

        {/* Traveler details accordion */}
        {booking.travelerDetails && booking.travelerDetails.length > 0 && (
          <TravelerDetailsAccordion travelers={booking.travelerDetails} />
        )}

        {/* Inline review — shown when user has reviewed this trip */}
        {showEditReview && booking.review && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarRating rating={booking.review.overallRating} size="sm" />
                <span className="text-xs text-neutral-400">
                  {formatDateFull(booking.review.createdAt)}
                </span>
                {booking.review.editedAt && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
                    <Pencil className="h-2.5 w-2.5" />
                    Edited
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onReview?.(booking)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </div>
            {booking.review.comment && (
              <p className="mt-1.5 text-sm text-neutral-600 line-clamp-2">
                {booking.review.comment}
              </p>
            )}
            {booking.review.photos.length > 0 && (
              <div className="mt-2 flex gap-1.5">
                {booking.review.photos.slice(0, 4).map((url) => (
                  <div key={url} className="relative h-10 w-10 overflow-hidden rounded border border-neutral-200">
                    <Image src={url} alt="Review photo" fill sizes="40px" className="object-cover" />
                  </div>
                ))}
                {booking.review.photos.length > 4 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-neutral-200 bg-neutral-100 text-xs text-neutral-500">
                    +{booking.review.photos.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom: amount + actions — mobile: stacked, desktop: row */}
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-neutral-900">{formatCurrency(booking.totalAmount)}</span>
            {countdown && (
              <span className="text-xs text-primary-600 font-medium">{countdown}</span>
            )}
          </div>

          {/* Actions — mobile: full width buttons, desktop: inline */}
          <div className="flex flex-col gap-2 md:flex-row">
            {showCancel && (
              <button
                type="button"
                onClick={() => onCancel?.(booking)}
                className="rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-sm font-medium text-error-700 hover:bg-error-100 transition-colors"
              >
                Cancel Booking
              </button>
            )}
            {showLeaveReview && (
              <button
                type="button"
                onClick={() => onReview?.(booking)}
                className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 py-1.5 px-3 text-sm md:w-auto"
              >
                <Star className="h-3.5 w-3.5" />
                Leave Review
              </button>
            )}
            <Link
              href={`/trips/${trip.slug}`}
              prefetch={false}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              View Trip
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
