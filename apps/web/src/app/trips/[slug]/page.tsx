'use client'

import Link from 'next/link'
import { useTripDetail } from '@/hooks/use-trip-detail'
import { TripDetailHeader } from '@/components/trips/trip-detail-header'
import { TripItinerary } from '@/components/trips/trip-itinerary'
import { TripBookingCard } from '@/components/trips/trip-booking-card'
import { TripReviews } from '@/components/trips/trip-reviews'
import { TripOrganizerCard } from '@/components/trips/trip-organizer-card'
import { ArrowLeft } from 'lucide-react'

export default function TripDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { data: trip, isLoading, error, refetch } = useTripDetail(slug)

  if (isLoading) {
    return <TripDetailSkeleton />
  }

  if (error || !trip) {
    const message =
      (error as Error)?.message ||
      'Could not load this trip. It may have been removed.'

    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 flex justify-center">
        <div className="max-w-md w-full rounded-xl bg-error-50 border border-red-200 p-8 text-center">
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-10">
          <TripDetailHeader trip={trip} />
          <TripItinerary itinerary={trip.itinerary} />
          <TripReviews reviews={trip.reviews} />
          <TripOrganizerCard organizer={trip.organizer} />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <TripBookingCard trip={trip} />
        </div>
      </div>
    </div>
  )
}

function TripDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="skeleton h-72 md:h-96 rounded-xl" />
          <div className="space-y-3">
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
          </div>
          <div className="space-y-3">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-4">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-2 rounded-full" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-4" />
              ))}
            </div>
            <div className="skeleton h-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
