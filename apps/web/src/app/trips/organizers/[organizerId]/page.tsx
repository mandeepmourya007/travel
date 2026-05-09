'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useOrganizerPublicProfile } from '@/hooks/use-organizer-public-profile'
import { OrganizerProfileHeader } from '@/components/trips/organizer-profile-header'
import { OrganizerReviewsSection } from '@/components/trips/organizer-reviews-section'
import { useProfile } from '@/hooks/use-profile'
import OrganizerProfileLoading from './loading'

export default function OrganizerPublicProfilePage({
  params,
}: {
  params: { organizerId: string }
}) {
  const { organizerId } = params
  const [reviewsPage, setReviewsPage] = useState(1)
  const { data: profile } = useProfile()
  const isOwner = profile?.organizerProfile?.id === organizerId

  const { data, isLoading, error, refetch } = useOrganizerPublicProfile({
    organizerId,
    reviewsPage,
    reviewsLimit: 10,
  })

  if (isLoading) {
    return <OrganizerProfileLoading />
  }

  if (error || !data) {
    const message =
      (error as Error)?.message ||
      'Could not load this organizer. They may not exist or are not verified.'

    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 flex justify-center">
        <div className="max-w-md w-full rounded-xl bg-error-50 border border-error-200 p-8 text-center">
          <p className="text-4xl mb-2">😕</p>
          <h2 className="text-base font-semibold text-neutral-800">
            Organizer not found
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
            <button onClick={() => refetch()} className="btn-outline">
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { organizer, reviews, reviewsSummary, reviewsPagination } = data

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all trips
      </Link>

      {/* Organizer header */}
      <OrganizerProfileHeader organizer={organizer} />

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
