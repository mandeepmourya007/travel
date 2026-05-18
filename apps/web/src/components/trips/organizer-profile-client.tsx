'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useOrganizerPublicProfile } from '@/hooks/use-organizer-public-profile'
import { OrganizerProfileHeader } from '@/components/trips/organizer-profile-header'
import { OrganizerReviewsSection } from '@/components/trips/organizer-reviews-section'
import { TripCard } from '@/components/trips/trip-card'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import { Pagination } from '@/components/shared/pagination'
import { useProfile } from '@/hooks/use-profile'
import type { OrganizerPublicProfileResponse } from '@shared/types/organizer.types'

interface OrganizerProfileClientProps {
  initialData: OrganizerPublicProfileResponse
  organizerId: string
}

export function OrganizerProfileClient({ initialData, organizerId }: OrganizerProfileClientProps) {
  const [reviewsPage, setReviewsPage] = useState(1)
  const [tripsPage, setTripsPage] = useState(1)
  const { data: profile } = useProfile()
  const isOwner = profile?.organizerProfile?.id === organizerId

  const { data, isLoading, error } = useOrganizerPublicProfile({
    organizerId,
    tripsPage,
    tripsLimit: 12,
    reviewsPage,
    reviewsLimit: 10,
    initialData: tripsPage === 1 && reviewsPage === 1 ? initialData : undefined,
  })

  const isPaginating = (tripsPage > 1 || reviewsPage > 1) && isLoading

  const {
    organizer,
    trips,
    tripsPagination,
    reviews,
    reviewsSummary,
    reviewsPagination,
  } = data ?? initialData

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href="/trips"
        prefetch={false}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all trips
      </Link>

      {/* Organizer header */}
      <OrganizerProfileHeader organizer={organizer} />

      {/* Error state */}
      {error && !isPaginating && (
        <div className="mt-8 rounded-xl bg-error-50 border border-error-200 p-8 text-center">
          <p className="text-sm text-neutral-600">{error.message}</p>
          <button onClick={() => { setTripsPage(1); setReviewsPage(1) }} className="btn-outline mt-4">
            Try Again
          </button>
        </div>
      )}

      {/* Trips section */}
      {isPaginating ? (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-neutral-800">
            Trips by {organizer.businessName}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ) : trips.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-neutral-800">
            Trips by {organizer.businessName}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
          {tripsPagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={tripsPagination.page}
                totalPages={tripsPagination.totalPages}
                total={tripsPagination.total}
                onPageChange={setTripsPage}
              />
            </div>
          )}
          {tripsPagination.total > trips.length && (
            <div className="mt-4 text-center">
              <Link
                href={`/trips?organizerId=${organizerId}`}
                prefetch={false}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                See all {tripsPagination.total} trips →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Reviews section */}
      <section className="mt-10">
        <OrganizerReviewsSection
          reviews={reviews}
          summary={reviewsSummary}
          pagination={reviewsPagination}
          onPageChange={setReviewsPage}
          isOwner={isOwner}
        />
      </section>
    </div>
  )
}
