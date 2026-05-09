'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { formatCurrency } from '@/lib/format'
import { BOOKING_STATUS_VARIANT } from '@/lib/admin-utils'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminBookings } from '@/hooks/use-admin-bookings'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import type { AdminBookingFilters } from '@shared/types/admin.types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
]

export default function AdminBookingsPage() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 300)

  const filters: AdminBookingFilters = {
    status: status === 'all' ? undefined : status as AdminBookingFilters['status'],
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  }

  const { data, isLoading, error, refetch } = useAdminBookings(filters)

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load bookings"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-neutral-900">Admin Bookings</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by booking ref or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableContainer>
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-48 flex-1" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-6 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </TableContainer>
      ) : !data?.data.length ? (
        <EmptyState message="No bookings match your filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead>Traveler</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="font-mono text-sm font-medium text-primary-600 hover:underline"
                        >
                          {booking.bookingRef}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {booking.trip.title}
                      </TableCell>
                      <TableCell className="text-sm">
                        {booking.user.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(booking.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={BOOKING_STATUS_VARIANT[booking.bookingStatus] ?? 'outline'}>
                          {booking.bookingStatus.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((booking) => (
              <Link
                key={booking.id}
                href={`/admin/bookings/${booking.id}`}
                className="card block space-y-2 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-primary-600">
                    {booking.bookingRef}
                  </span>
                  <Badge variant={BOOKING_STATUS_VARIANT[booking.bookingStatus] ?? 'outline'} className="text-xs">
                    {booking.bookingStatus.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-neutral-800 line-clamp-1">{booking.trip.title}</p>
                <div className="flex items-center justify-between text-sm text-neutral-500">
                  <span>{booking.user.name}</span>
                  <span className="font-mono">{formatCurrency(booking.totalAmount)}</span>
                </div>
              </Link>
            ))}
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="pt-4">
              <Pagination
                currentPage={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
