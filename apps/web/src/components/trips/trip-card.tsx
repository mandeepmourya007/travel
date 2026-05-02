'use client'

import { useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQueryClient } from '@tanstack/react-query'
import { MapPin, Calendar, Users, CheckCircle, GitCompareArrows } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import { formatCurrency, formatDateRange, getTripDuration, getSeatsLeft, tripTypeLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { tripKeys } from '@/lib/query-keys'
import { fetchTripDetail } from '@/hooks/use-trip-detail'
import type { TripSummary } from '@shared/types/trip.types'

interface TripCardProps {
  trip: TripSummary
  onCompare: (trip: TripSummary) => void
  isSelected?: boolean
}

/**
 * Trip listing card with compare toggle, image, metadata, and price CTA.
 *
 * The compare button shows a pulse-zoom animation on initial mount to
 * draw attention, then switches to a pop animation when selected.
 * Animation only plays on first render — not when toggling back from selected.
 *
 * @note `onCompare` is required and receives the full `TripSummary` (not just id)
 *       so the compare queue can store a lightweight snapshot without re-fetching.
 */
export function TripCard({ trip, onCompare, isSelected = false }: TripCardProps) {
  const queryClient = useQueryClient()
  const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
  const coverPhoto = trip.photos[0] || '/placeholder-trip.jpg'
  const hasInteracted = useRef(false)

  const prefetchTripDetail = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: tripKeys.detail(trip.slug),
      queryFn: () => fetchTripDetail(trip.slug),
      staleTime: 60 * 1000,
    })
  }, [queryClient, trip.slug])
  return (
    <div className={cn('card group relative', isSelected && 'ring-2 ring-primary-500 border-primary-200')}>
      {/* Compare button */}
      <button
        onClick={(e) => {
          e.preventDefault()
          hasInteracted.current = true
          onCompare(trip)
        }}
        className={cn(
          'absolute top-3 left-3 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold shadow-sm',
          'transition-all duration-200 active:scale-90 will-change-transform',
          isSelected
            ? 'bg-primary-500 text-white hover:bg-primary-600 animate-pop'
            : 'bg-white/90 backdrop-blur-sm text-neutral-600 hover:bg-white',
          !isSelected && !hasInteracted.current && 'animate-pulse-zoom',
        )}
        aria-label={isSelected ? 'Remove from comparison' : 'Add to comparison'}
      >
        <GitCompareArrows className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        {isSelected ? 'Added' : 'Compare'}
      </button>

      {/* Image */}
      <Link href={`/trips/${trip.slug}`} className="block">
        <div className="relative h-48 overflow-hidden bg-neutral-200">
          <Image
            src={coverPhoto}
            alt={trip.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
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
            onMouseEnter={prefetchTripDetail}
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  )
}
