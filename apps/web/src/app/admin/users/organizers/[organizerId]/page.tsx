'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Map } from 'lucide-react'
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
import { useAdminOrganizerTrips } from '@/hooks/use-admin-organizer-directory'
import { TRIP_STATUS, type TripStatusConst } from '@shared/constants/trip-types'

const TRIP_STATUS_OPTIONS: { value: 'all' | TripStatusConst; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: TRIP_STATUS.DRAFT, label: 'Draft' },
  { value: TRIP_STATUS.ACTIVE, label: 'Active' },
  { value: TRIP_STATUS.FULL, label: 'Full' },
  { value: TRIP_STATUS.COMPLETED, label: 'Completed' },
  { value: TRIP_STATUS.CANCELLED, label: 'Cancelled' },
]

export default function AdminOrganizerDetailPage() {
  const { organizerId } = useParams<{ organizerId: string }>()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const { data, isLoading, error, refetch } = useAdminOrganizerTrips(organizerId, {
    status: status === 'all' ? undefined : (status as TripStatusConst),
    page,
    limit: 20,
  })

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load organizer"
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
          <StatCardSkeleton />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      ) : (
        <>
          <div>
            <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">
              {data.organizer.businessName}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {data.organizer.email ?? '—'} · {data.organizer.phone ?? '—'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Trips Created" value={data.organizer.tripsCount} icon={<Map className="h-6 w-6" />} />
            <StatCard label="Verification Status" value={data.organizer.verificationStatus} compact={false} />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-neutral-900">Trips Created</h2>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {TRIP_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {data.trips.data.length === 0 ? (
              <EmptyState
                message={
                  status === 'all'
                    ? "This organizer hasn't created any trips yet."
                    : 'No trips match the selected status.'
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
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead>Created On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.trips.data.map((trip) => (
                          <TableRow key={trip.id}>
                            <TableCell className="max-w-[220px] truncate font-medium text-neutral-900">
                              {trip.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{trip.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              ₹{trip.pricePerPerson.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {trip.currentBookings}/{trip.maxGroupSize}
                            </TableCell>
                            <TableCell className="text-sm text-neutral-500">
                              {new Date(trip.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {data.trips.data.map((trip) => (
                    <div key={trip.id} className="card-static space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-neutral-900 line-clamp-1">{trip.title}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">{trip.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-neutral-500">
                        <span>{trip.currentBookings}/{trip.maxGroupSize} bookings</span>
                        <span className="font-mono">₹{trip.pricePerPerson.toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {new Date(trip.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
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
        </>
      )}
    </div>
  )
}
