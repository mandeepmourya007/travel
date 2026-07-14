'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard, StatCardSkeleton } from '@/components/dashboard/stat-card'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { useAdminTravellerDetail } from '@/hooks/use-admin-travellers'
import { BOOKING_STATUS_VARIANT } from '@/lib/admin-utils'
import { BOOKING_STATUS, type BookingStatusConst } from '@shared/constants/booking-status'

const BOOKING_STATUS_OPTIONS: { value: 'all' | BookingStatusConst; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: BOOKING_STATUS.CONFIRMED, label: 'Confirmed' },
  { value: BOOKING_STATUS.COMPLETED, label: 'Completed' },
  { value: BOOKING_STATUS.CANCELLED, label: 'Cancelled' },
  { value: BOOKING_STATUS.REFUNDED, label: 'Refunded' },
  { value: BOOKING_STATUS.EXPIRED, label: 'Expired' },
  { value: BOOKING_STATUS.PENDING_PAYMENT, label: 'Pending Payment' },
]

export default function AdminTravellerDetailPage() {
  const { travellerId } = useParams<{ travellerId: string }>()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const { data, isLoading, error, refetch } = useAdminTravellerDetail(travellerId, {
    status: status === 'all' ? undefined : (status as BookingStatusConst),
    page,
    limit: 20,
  })

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load traveller"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="skeleton h-7 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : (
        <>
          <div>
            <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">
              {data.user.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {data.user.email ?? '—'} · {data.user.phone ?? '—'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Trips Booked" value={data.user.bookingsCount} icon={<Package className="h-6 w-6" />} />
            <StatCard label="Reviews Given" value={data.reviews.total} icon={<Star className="h-6 w-6" />} />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-neutral-900">Booked Trips</h2>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {data.trips.data.length === 0 ? (
              <EmptyState
                message={
                  status === 'all'
                    ? "This traveller hasn't booked any trips yet."
                    : 'No booked trips match the selected status.'
                }
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trip</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Booked On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.trips.data.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell className="max-w-[220px] truncate font-medium text-neutral-900">
                              {booking.trip.title}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              ₹{booking.totalAmount.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={BOOKING_STATUS_VARIANT[booking.bookingStatus] ?? 'outline'}>
                                {booking.bookingStatus.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-neutral-500">
                              {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {data.trips.data.map((booking) => (
                    <div key={booking.id} className="card-static space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-neutral-900 line-clamp-1">{booking.trip.title}</p>
                        <Badge variant={BOOKING_STATUS_VARIANT[booking.bookingStatus] ?? 'outline'} className="shrink-0 text-xs">
                          {booking.bookingStatus.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-neutral-500">
                        <span>{new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        <span className="font-mono">₹{booking.totalAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {data.trips.pagination.totalPages > 1 && (
                  <div className="pt-4">
                    <Pagination
                      currentPage={data.trips.pagination.page}
                      totalPages={data.trips.pagination.totalPages}
                      total={data.trips.pagination.total}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-neutral-900">Reviews Given</h2>
            {data.reviews.data.length === 0 ? (
              <EmptyState message="This traveller hasn't written any reviews yet." />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trip</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Comment</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.reviews.data.map((review) => (
                          <TableRow key={review.id}>
                            <TableCell className="max-w-[200px] truncate font-medium text-neutral-900">
                              {review.trip.title}
                            </TableCell>
                            <TableCell className="text-sm text-warning-600">
                              {'★'.repeat(review.overallRating)}{'☆'.repeat(5 - review.overallRating)}
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate text-sm text-neutral-600">
                              {review.comment ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm text-neutral-500">
                              {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {data.reviews.data.map((review) => (
                    <div key={review.id} className="card-static space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-neutral-900 line-clamp-1">{review.trip.title}</p>
                        <span className="shrink-0 text-sm text-warning-600">
                          {'★'.repeat(review.overallRating)}{'☆'.repeat(5 - review.overallRating)}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-neutral-600 line-clamp-2">{review.comment}</p>
                      )}
                      <p className="text-xs text-neutral-400">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
