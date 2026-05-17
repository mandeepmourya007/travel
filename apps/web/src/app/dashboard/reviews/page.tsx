'use client'

import Link from 'next/link'
import { Star, MessageSquare, ExternalLink } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'

export default function DashboardReviewsPage() {
  const { data: profile, isLoading } = useProfile()

  const orgProfile = profile?.organizerProfile
  const isApproved = orgProfile?.verificationStatus === 'APPROVED'

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-neutral-900">Reviews</h2>
        <p className="text-sm text-neutral-500">See what travelers say about your trips</p>
      </div>

      {isApproved && orgProfile?.slug ? (
        <div className="card-static p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-warning-500" />
              <div>
                <p className="text-sm font-semibold text-neutral-800">
                  {orgProfile.rating.toFixed(1)} rating · {orgProfile.totalReviews} reviews
                </p>
                <p className="text-xs text-neutral-500">
                  View your full public profile with all reviews
                </p>
              </div>
            </div>
            <Link
              href={`/trips/organizers/${orgProfile.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              View Profile
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-16 text-center">
          <MessageSquare className="h-10 w-10 text-neutral-300" />
          <p className="mt-4 text-sm font-semibold text-neutral-700">No reviews yet</p>
          <p className="mt-1 max-w-sm text-xs text-neutral-500">
            Reviews will appear here once travelers complete trips and leave feedback.
            {!isApproved && ' Your profile needs to be approved before travelers can book your trips.'}
          </p>
        </div>
      )}
    </div>
  )
}
