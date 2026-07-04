'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { AdminBookingFilters, AdminBookingSortBy, SortOrder } from '@shared/types/admin.types'
import { SORT_ORDER } from '@shared/constants/sort'

const SORT_OPTIONS: { field: AdminBookingSortBy; label: string }[] = [
  { field: 'totalAmount', label: 'Amount' },
  { field: 'bookingStatus', label: 'Status' },
  { field: 'createdAt', label: 'Date' },
]

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
  const [sortBy, setSortBy] = useState<AdminBookingSortBy | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<SortOrder>(SORT_ORDER.DESC)
  const debouncedSearch = useDebounce(search, 300)

  function handleSort(field: AdminBookingSortBy) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === SORT_ORDER.ASC ? SORT_ORDER.DESC : SORT_ORDER.ASC))
    } else {
      setSortBy(field)
      setSortOrder(SORT_ORDER.DESC)
    }
    setPage(1)
  }

  const filters: AdminBookingFilters = {
    status: status === 'all' ? undefined : status as AdminBookingFilters['status'],
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder: sortBy ? sortOrder : undefined,
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

      {/* Mobile sort chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
        <span className="shrink-0 text-xs text-neutral-500">Sort:</span>
        {SORT_OPTIONS.map(({ field, label }) => {
          const active = sortBy === field
          return (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
              )}
            >
              {label}
              {active && (sortOrder === SORT_ORDER.ASC ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
          )
        })}
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
                    <SortableHead field="totalAmount" label="Amount" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                    <SortableHead field="bookingStatus" label="Status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHead field="createdAt" label="Date" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
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

function SortableHead({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  className,
}: {
  field: AdminBookingSortBy
  label: string
  sortBy: AdminBookingSortBy | undefined
  sortOrder: SortOrder
  onSort: (field: AdminBookingSortBy) => void
  className?: string
}) {
  const active = sortBy === field
  const Icon = active ? (sortOrder === SORT_ORDER.ASC ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1.5 font-medium hover:text-neutral-900 transition-colors"
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary-600' : 'text-neutral-400')} />
      </button>
    </TableHead>
  )
}
