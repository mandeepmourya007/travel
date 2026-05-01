'use client'

import Link from 'next/link'
import { MapPin, Calendar, Users, CheckCircle } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import { formatCurrency, formatDateRange, getTripDuration, getSeatsLeft, tripTypeLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripSummary } from '@shared/types/trip.types'

interface TripCardProps {
  trip: TripSummary
  onCompare?: (tripId: string) => void
  isSelected?: boolean
}

export function TripCard({ trip, onCompare, isSelected = false }: TripCardProps) {
  const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
  const coverPhoto = trip.photos[0] || '/placeholder-trip.jpg'

  return (
    <div className={cn('card group relative', isSelected && 'ring-2 ring-primary-500')}>
      {/* Compare checkbox */}
      {onCompare && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onCompare(trip.id)
          }}
          className={cn(
            'absolute top-3 left-3 z-10 h-6 w-6 rounded border-2 flex items-center justify-center transition-all',
            isSelected
              ? 'border-primary-500 bg-primary-500 text-white'
              : 'border-white/80 bg-white/70 backdrop-blur-sm text-transparent hover:border-primary-300',
          )}
          aria-label={isSelected ? 'Remove from comparison' : 'Add to comparison'}
        >
          {isSelected && <CheckCircle className="h-4 w-4" />}
        </button>
      )}

      {/* Image */}
      <Link href={`/trips/${trip.slug}`} className="block">
        <div className="relative h-48 overflow-hidden bg-neutral-200">
          <img
            src={coverPhoto}
            alt={trip.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Booking mode badge */}
          <span
            className={cn(
              'absolute top-3 right-3 badge text-xs font-semibold',
              trip.bookingMode === 'INSTANT' ? 'bg-success-50 text-success-500' : 'bg-warning-50 text-warning-500',
            )}
          >
            {trip.bookingMode === 'INSTANT' ? 'Instant Book' : 'Request'}
          </span>
          {/* Seats urgency */}
          {seatsLeft > 0 && seatsLeft <= 5 && (
            <span className="absolute bottom-3 right-3 badge bg-accent-50 text-accent-700 text-xs font-semibold">
              {seatsLeft} seats left
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/trips/${trip.slug}`} className="block">
          <h3 className="font-display text-base font-bold text-neutral-800 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {trip.title}
          </h3>
        </Link>

        {/* Organizer */}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-sm text-neutral-500">by {trip.organizer.businessName}</span>
          {trip.organizer.verified && <CheckCircle className="h-3.5 w-3.5 text-primary-500" />}
        </div>

        {/* Rating */}
        {trip.organizer.totalReviews > 0 && (
          <div className="mt-1.5">
            <StarRating
              rating={trip.organizer.rating}
              showValue
              count={trip.organizer.totalReviews}
            />
          </div>
        )}

        {/* Meta */}
        <div className="mt-3 space-y-1.5 text-sm text-neutral-500">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-neutral-400" />
            <span>{trip.destination.name}</span>
            <span className="badge-primary text-xs ml-auto">{tripTypeLabel(trip.tripType)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            <span>
              {formatDateRange(trip.startDate, trip.endDate)} &middot;{' '}
              {getTripDuration(trip.startDate, trip.endDate)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-neutral-400" />
            <span>
              {trip.currentBookings}/{trip.maxGroupSize} booked
            </span>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
          <div>
            {trip.earlyBirdPrice ? (
              <>
                <span className="text-lg font-bold text-accent-500">
                  {formatCurrency(trip.earlyBirdPrice)}
                </span>
                <span className="text-xs text-neutral-400 line-through ml-1.5">
                  {formatCurrency(trip.pricePerPerson)}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-accent-500">
                {formatCurrency(trip.pricePerPerson)}
              </span>
            )}
            <span className="text-xs text-neutral-400 ml-1">/person</span>
          </div>
          <Link
            href={`/trips/${trip.slug}`}
            className="rounded-lg bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition-all hover:bg-primary-100"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  )
}
