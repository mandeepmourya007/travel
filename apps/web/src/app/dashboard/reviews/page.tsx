'use client'

import { useState } from 'react'
import { Star, MessageSquare } from 'lucide-react'
import { TripSearchCombobox } from '@/components/shared/trip-search-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OrganizerReviewCard } from '@/components/dashboard/organizer-review-card'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { useOrganizerReviews } from '@/hooks/use-reviews'
import { useProfile } from '@/hooks/use-profile'
import { REVIEW_SORT, REVIEW_RATING_VALUES } from '@shared/constants/review'
import type { OrganizerReviewFilters } from '@shared/types/review.types'

const RATING_OPTIONS = [
  { value: 'all', label: 'All Ratings' },
  ...REVIEW_RATING_VALUES.map((v) => ({
    value: String(v),
    label: `${'★'.repeat(v)}  ${v} Star${v !== 1 ? 's' : ''}`,
  })),
]

const SORT_OPTIONS = [
  { value: REVIEW_SORT.NEWEST, label: 'Newest First' },
  { value: REVIEW_SORT.OLDEST, label: 'Oldest First' },
  { value: REVIEW_SORT.RATING_HIGH, label: 'Rating: High → Low' },
  { value: REVIEW_SORT.RATING_LOW, label: 'Rating: Low → High' },
]

export default function DashboardReviewsPage() {
  const [tripId, setTripId] = useState<string | undefined>()
  const [rating, setRating] = useState('all')
  const [sort, setSort] = useState(REVIEW_SORT.NEWEST)
  const [page, setPage] = useState(1)

  const { data: profile } = useProfile()
  const orgProfile = profile?.organizerProfile

  const filters: OrganizerReviewFilters = {
    tripId: tripId || undefined,
    rating: rating !== 'all' ? Number(rating) : undefined,
    sort: sort as OrganizerReviewFilters['sort'],
    page,
    limit: 10,
  }

  const { data, isLoading, error, refetch } = useOrganizerReviews(filters)

  function resetPage() {
    setPage(1)
  }

  const hasActiveFilter = !!tripId || rating !== 'all'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold text-neutral-900">Reviews</h2>
        <p className="text-sm text-neutral-500">Manage traveler feedback and reply to reviews</p>
      </div>

      {/* Stats bar */}
      {orgProfile && orgProfile.totalReviews > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <Star className="h-5 w-5 fill-warning-400 text-warning-400" />
          <p className="text-sm text-neutral-700">
            <span className="font-bold text-neutral-900">{orgProfile.rating.toFixed(1)}</span>
            {' '}avg rating · {' '}
            <span className="font-semibold">{orgProfile.totalReviews}</span>
            {' '}total reviews
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-60">
          <TripSearchCombobox
            value={tripId}
            onChange={(v) => { setTripId(v); resetPage() }}
            placeholder="All Trips"
          />
        </div>
        <Select value={rating} onValueChange={(v) => { setRating(v); resetPage() }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Ratings" />
          </SelectTrigger>
          <SelectContent>
            {RATING_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v as typeof sort); resetPage() }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Couldn't load reviews" message={error.message} onRetry={refetch} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="mx-auto h-10 w-10 text-neutral-300" />}
          message={
            hasActiveFilter
              ? 'No reviews match your filters.'
              : 'No reviews yet. Reviews appear once travelers complete a trip.'
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {data.data.map((review) => (
              <div key={review.id} className="space-y-1">
                {review.trip && (
                  <p className="pl-1 text-xs font-medium text-neutral-400">{review.trip.title}</p>
                )}
                <OrganizerReviewCard review={review} />
              </div>
            ))}
          </div>
          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
