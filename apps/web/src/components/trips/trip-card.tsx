'use client'

import { memo, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { BlurImage } from '@/components/shared/blur-image'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { MapPin, Calendar, Users, CheckCircle, GitCompareArrows, Armchair } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import { formatCurrency, formatDateRange, getTripDuration } from '@/lib/format'
import { SeatsLeftBadge } from '@/components/trips/seats-left-badge'
import { cn } from '@/lib/utils'
import { tripKeys } from '@/lib/query-keys'
import { fetchTripDetail } from '@/hooks/use-trip-detail'
import type { TripSummary } from '@shared/types/trip.types'

/** Hover-intent delay before prefetching — avoids firing for every card the cursor sweeps across */
const PREFETCH_HOVER_DELAY_MS = 150

interface TripCardProps {
  trip: TripSummary
  onCompare?: (trip: TripSummary) => void
  isSelected?: boolean
  priority?: boolean
}

/**
 * Trip listing card with compare toggle, image, metadata, and price CTA.
 *
 * The compare button shows a pulse-zoom animation on initial mount to
 * draw attention, then switches to a pop animation when selected.
 * Animation only plays on first render — not when toggling back from selected.
 *
 * @note `onCompare` receives the full `TripSummary` (not just id)
 *       so the compare queue can store a lightweight snapshot without re-fetching.
 *       When omitted, the compare button is hidden.
 */
export const TripCard = memo(function TripCard({ trip, onCompare, isSelected = false, priority = false }: TripCardProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const coverPhoto = trip.photos[0] || '/placeholder-trip.jpg'
  const hasInteracted = useRef(false)

  // Warm BOTH caches on hover: the RSC route (links have prefetch={false} to
  // avoid 12+ eager prefetches per grid) and the React Query detail used by /book.
  const prefetchTripDetail = useCallback(() => {
    router.prefetch(`/trips/${trip.slug}`)
    queryClient.prefetchQuery({
      queryKey: tripKeys.detail(trip.slug),
      queryFn: () => fetchTripDetail(trip.slug),
      staleTime: 60 * 1000,
    })
  }, [queryClient, router, trip.slug])

  // Hover-intent: only prefetch once the cursor rests on the card
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedulePrefetch = useCallback(() => {
    prefetchTimerRef.current = setTimeout(prefetchTripDetail, PREFETCH_HOVER_DELAY_MS)
  }, [prefetchTripDetail])
  const cancelScheduledPrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }, [])
  useEffect(() => cancelScheduledPrefetch, [cancelScheduledPrefetch])

  return (
    <div
      className={cn('card group relative', isSelected && 'ring-2 ring-primary-500 border-primary-200')}
      onMouseEnter={schedulePrefetch}
      onMouseLeave={cancelScheduledPrefetch}
    >
      {/* Compare button */}
      {onCompare && (
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
      )}

      {/* Image */}
      <Link href={`/trips/${trip.slug}`} prefetch={false} className="block">
        <div className="relative h-48 overflow-hidden bg-neutral-200">
          <BlurImage
            src={coverPhoto}
            alt={trip.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={60}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
          {/* Trending badge — offset below the compare button (top-3 left-3 on outer card) */}
          {trip.isTrending && (
            <span className="absolute top-10 left-3 badge text-xs font-semibold bg-accent-50 text-accent-700 z-10">
              🔥 Trending
            </span>
          )}
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
          <SeatsLeftBadge
            maxGroupSize={trip.maxGroupSize}
            currentBookings={trip.currentBookings}
            className="absolute bottom-3 right-3"
          />
          {trip.seatSelectionEnabled && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
              <Armchair className="h-3 w-3" />
              Choose Seat
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/trips/${trip.slug}`} prefetch={false} className="block">
          <h3 className="font-display text-base font-bold text-neutral-800 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {trip.title}
          </h3>
        </Link>

        {/* Organizer */}
        <div className="mt-1 flex items-center gap-1.5">
          <Link href={`/trips/organizers/${trip.organizer.slug}`} prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
            by {trip.organizer.businessName}
          </Link>
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
            <Link
              href={`/destinations/${trip.destination.slug}`}
              prefetch={false}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary-600 transition-colors"
            >
              {trip.destination.name}
            </Link>
            <span className="badge-primary text-xs ml-auto">{trip.tripTypeLabel}</span>
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
            prefetch={false}
            className="whitespace-nowrap rounded-lg bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition-all hover:bg-primary-100"
            onMouseEnter={prefetchTripDetail}
            onFocus={prefetchTripDetail}
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  )
})
