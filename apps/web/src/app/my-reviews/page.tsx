'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { AuthGuard } from '@/components/shared/auth-guard'
import { TravelerReviewCard } from '@/components/reviews/traveler-review-card'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TravelerTripSearchCombobox } from '@/components/shared/trip-search-combobox'
import { useMyReviews } from '@/hooks/use-reviews'
import { REVIEW_SORT } from '@shared/constants/review'
import { TRAVELER_ROLES } from '@shared/constants/roles'
import type { ReviewListFilters } from '@shared/types/review.types'

const SORT_OPTIONS = [
  { value: REVIEW_SORT.NEWEST, label: 'Newest First' },
  { value: REVIEW_SORT.OLDEST, label: 'Oldest First' },
  { value: REVIEW_SORT.RATING_HIGH, label: 'Rating: High → Low' },
  { value: REVIEW_SORT.RATING_LOW, label: 'Rating: Low → High' },
]

export default function MyReviewsPage() {
  const [sort, setSort] = useState(REVIEW_SORT.NEWEST)
  const [tripId, setTripId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const filters: ReviewListFilters = {
    sort: sort as ReviewListFilters['sort'],
    tripId,
    page,
    limit: 10,
  }

  const { data, isLoading, error, refetch } = useMyReviews(filters)

  return (
    <AuthGuard allowedRoles={[...TRAVELER_ROLES]}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">
            My Reviews
          </h1>
          <p className="text-sm text-neutral-500">Reviews you&apos;ve written for completed trips</p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:w-56">
            <TravelerTripSearchCombobox
              value={tripId}
              onChange={(id) => { setTripId(id); setPage(1) }}
            />
          </div>
          <Select
            value={sort}
            onValueChange={(v) => { setSort(v as typeof sort); setPage(1) }}
          >
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
              <div key={i} className="skeleton h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load your reviews"
            message={error.message}
            onRetry={refetch}
          />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="mx-auto h-10 w-10 text-neutral-300" />}
            message="You haven't written any reviews yet. Complete a trip to leave feedback."
          />
        ) : (
          <>
            <div className="space-y-4">
              {data.data.map((review) => (
                <TravelerReviewCard key={review.id} review={review} />
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
    </AuthGuard>
  )
}
