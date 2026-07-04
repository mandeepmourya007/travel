'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableContainer,
} from '@/components/ui/table'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { StarRating } from '@/components/shared/star-rating'
import { useDebounce } from '@/hooks/use-debounce'
import { useAdminReviews } from '@/hooks/use-admin-reviews'
import { AdminTripSearchCombobox } from '@/components/shared/trip-search-combobox'
import { formatDateFull } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SORT_ORDER } from '@shared/constants/sort'
import { ADMIN_REVIEW_SORT_BY } from '@shared/constants/admin'
import { REVIEW_RATING_VALUES } from '@shared/constants/review'
import type { AdminReviewFilters, AdminReviewSortBy, SortOrder } from '@shared/types/admin.types'

const RATING_OPTIONS = [
  { value: 'all', label: 'All Ratings' },
  ...REVIEW_RATING_VALUES.map((v) => ({
    value: String(v),
    label: `${v} Star${v !== 1 ? 's' : ''}`,
  })),
]

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-neutral-400" />
  return order === SORT_ORDER.ASC
    ? <ArrowUp className="ml-1 inline h-3.5 w-3.5 text-primary-600" />
    : <ArrowDown className="ml-1 inline h-3.5 w-3.5 text-primary-600" />
}

const COMMENT_PREVIEW_LENGTH = 80

export default function AdminReviewsPage() {
  const [organizerSearch, setOrganizerSearch] = useState('')
  const [tripId, setTripId] = useState<string | undefined>(undefined)
  const [rating, setRating] = useState('all')
  const [sortBy, setSortBy] = useState<AdminReviewSortBy | undefined>()
  const [sortOrder, setSortOrder] = useState<SortOrder>(SORT_ORDER.DESC)
  const [page, setPage] = useState(1)

  const debouncedOrganizer = useDebounce(organizerSearch, 300)

  const filters: AdminReviewFilters = {
    organizerSearch: debouncedOrganizer || undefined,
    tripId,
    rating: rating !== 'all' ? Number(rating) : undefined,
    sortBy,
    sortOrder,
    page,
  }

  const { data, isLoading, error, refetch } = useAdminReviews(filters)

  function handleSort(field: AdminReviewSortBy) {
    if (sortBy === field) {
      setSortOrder((prev) => prev === SORT_ORDER.ASC ? SORT_ORDER.DESC : SORT_ORDER.ASC)
    } else {
      setSortBy(field)
      setSortOrder(SORT_ORDER.DESC)
    }
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">Reviews</h1>
        <p className="text-sm text-neutral-500">All platform reviews</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search organizer…"
          value={organizerSearch}
          onChange={(e) => { setOrganizerSearch(e.target.value); setPage(1) }}
          className="w-full sm:w-52"
        />
        <div className="w-full sm:w-52">
          <AdminTripSearchCombobox
            value={tripId}
            onChange={(id) => { setTripId(id); setPage(1) }}
          />
        </div>
        <Select value={rating} onValueChange={(v) => { setRating(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Ratings" />
          </SelectTrigger>
          <SelectContent>
            {RATING_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Couldn't load reviews" message={error.message} onRetry={refetch} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState message="No reviews match your filters." />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Trip</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort(ADMIN_REVIEW_SORT_BY.ORGANIZER_NAME)}
                  >
                    Organizer
                    <SortIcon active={sortBy === ADMIN_REVIEW_SORT_BY.ORGANIZER_NAME} order={sortOrder} />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort(ADMIN_REVIEW_SORT_BY.OVERALL_RATING)}
                  >
                    Rating
                    <SortIcon active={sortBy === ADMIN_REVIEW_SORT_BY.OVERALL_RATING} order={sortOrder} />
                  </TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Reply</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort(ADMIN_REVIEW_SORT_BY.CREATED_AT)}
                  >
                    Date
                    <SortIcon active={sortBy === ADMIN_REVIEW_SORT_BY.CREATED_AT} order={sortOrder} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium text-sm">{review.user.name}</TableCell>
                    <TableCell className="text-sm text-neutral-600 max-w-[160px] truncate">
                      {review.trip.title}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-600">
                      {review.trip.organizer.businessName}
                    </TableCell>
                    <TableCell>
                      <StarRating rating={review.overallRating} size="sm" />
                    </TableCell>
                    <TableCell className={cn(
                      'text-sm text-neutral-500 max-w-[200px] truncate',
                      !review.comment && 'text-neutral-300 italic',
                    )}>
                      {review.comment
                        ? review.comment.slice(0, COMMENT_PREVIEW_LENGTH) + (review.comment.length > COMMENT_PREVIEW_LENGTH ? '…' : '')
                        : 'No comment'}
                    </TableCell>
                    <TableCell>
                      {review.organizerReply ? (
                        <Badge className="text-xs">Replied</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-neutral-400">No reply</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-neutral-400 whitespace-nowrap">
                      {formatDateFull(review.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
