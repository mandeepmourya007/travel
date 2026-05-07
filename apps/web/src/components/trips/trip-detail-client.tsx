'use client'

import Link from 'next/link'
import { useTripDetail } from '@/hooks/use-trip-detail'
import { TripDetailHeader } from '@/components/trips/trip-detail-header'
import { TripItinerary } from '@/components/trips/trip-itinerary'
import { TripBookingCard } from '@/components/trips/trip-booking-card'
import { TripStickyBookBar } from '@/components/trips/trip-sticky-book-bar'
import { TripReviews } from '@/components/trips/trip-reviews'
import { TransferPointsTable } from '@/components/trips/transfer-points-table'
import { TripOrganizerCard } from '@/components/trips/trip-organizer-card'
import { ChatWithOrganizerButton } from '@/components/chat'
import { ArrowLeft } from 'lucide-react'
import type { TripDetail } from '@shared/types/trip.types'

interface TripDetailClientProps {
  trip: TripDetail
  slug: string
}

export function TripDetailClient({ trip: initialTrip, slug }: TripDetailClientProps) {
  const { data: trip, error, refetch } = useTripDetail(slug, initialTrip)

  if (error || !trip) {
    const message =
      (error as Error)?.message ||
      'Could not load this trip. It may have been removed.'

    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 flex justify-center">
        <div className="max-w-md w-full rounded-xl bg-error-50 border border-neutral-200 p-8 text-center">
          <p className="text-4xl mb-2">😕</p>
          <h2 className="text-base font-semibold text-neutral-800">
            Trip not found
          </h2>
          <p className="mt-1 text-sm text-neutral-500">{message}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/trips"
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              All Trips
            </Link>
            <button
              onClick={() => refetch()}
              className="btn-outline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 lg:pb-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-10">
          <TripDetailHeader trip={trip} />
          <TripItinerary itinerary={trip.itinerary} />
          <TransferPointsTable pickupPoints={trip.pickupPoints} dropPoints={trip.dropPoints} />
          <TripOrganizerCard organizer={trip.organizer} />
          <ChatWithOrganizerButton tripId={trip.id} />
          <TripReviews reviews={trip.reviews} />
        </div>

        {/* Sidebar — hidden on mobile, sticky sidebar on desktop */}
        <div className="hidden lg:block lg:col-span-1">
          <TripBookingCard trip={trip} />
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <TripStickyBookBar trip={trip} />
    </div>
  )
}
