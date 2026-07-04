'use client'

import { useState } from 'react'
import { Search, Lock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebounce } from '@/hooks/use-debounce'
import { useAdminTrips } from '@/hooks/use-admin-trips'
import { useAdminToggleTripBookings } from '@/hooks/use-admin-toggle-trip-bookings'
import { useAdminSetTripVisibility } from '@/hooks/use-admin-set-trip-visibility'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { formatDateRange, formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrganizerTripListItem } from '@shared/types/trip.types'
import type { AdminTripSortBy, SortOrder } from '@shared/types/admin.types'

const TRIP_STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  FULL: 'outline',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'FULL', label: 'Full' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const SORT_OPTIONS: { field: AdminTripSortBy; label: string }[] = [
  { field: 'destination', label: 'Destination' },
  { field: 'startDate', label: 'Dates' },
  { field: 'pricePerPerson', label: 'Price' },
  { field: 'status', label: 'Status' },
]

type ActionType = 'pause' | 'resume' | 'hide' | 'unhide'

interface PendingAction {
  type: ActionType
  trip: OrganizerTripListItem
}

export default function AdminTripsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<AdminTripSortBy | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const debouncedSearch = useDebounce(search, 300)

  function handleSort(field: AdminTripSortBy) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionReason, setActionReason] = useState('')

  const filters = {
    q: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    sortBy,
    sortOrder: sortBy ? sortOrder : undefined,
    page,
    limit: 20,
  }

  const { data, isLoading, error, refetch } = useAdminTrips(filters)
  const toggleBookings = useAdminToggleTripBookings()
  const setVisibility = useAdminSetTripVisibility()

  function openAction(type: ActionType, trip: OrganizerTripListItem) {
    setActionReason('')
    setPendingAction({ type, trip })
  }

  function handleConfirm() {
    if (!pendingAction) return
    const { type, trip } = pendingAction
    const reason = actionReason.trim() || undefined

    if (type === 'pause') {
      toggleBookings.mutate({ tripId: trip.id, paused: true, reason, slug: trip.slug })
    } else if (type === 'resume') {
      toggleBookings.mutate({ tripId: trip.id, paused: false, reason, slug: trip.slug })
    } else if (type === 'hide') {
      setVisibility.mutate({ tripId: trip.id, hidden: true, reason, slug: trip.slug })
    } else {
      setVisibility.mutate({ tripId: trip.id, hidden: false, reason, slug: trip.slug })
    }

    setPendingAction(null)
  }

  const isPending = toggleBookings.isPending || setVisibility.isPending

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load trips"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-neutral-900">Admin Trips</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by title or destination..."
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
              {active && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <>
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <TableContainer>
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5">
                    <div className="skeleton h-4 w-48 flex-1" />
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-6 w-20 rounded-full" />
                    <div className="skeleton h-8 w-24" />
                  </div>
                ))}
              </div>
            </TableContainer>
          </div>
          {/* Mobile skeleton */}
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="skeleton h-3 w-24" />
                  <div className="flex gap-2">
                    <div className="skeleton h-8 w-28 rounded-md" />
                    <div className="skeleton h-8 w-20 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : !data?.data.length ? (
        <EmptyState message="No trips match your filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip</TableHead>
                    <SortableHead field="destination" label="Destination" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHead field="startDate" label="Dates" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHead field="pricePerPerson" label="Price" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                    <SortableHead field="status" label="Status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <TableHead>Flags</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((trip) => (
                    <TripRow
                      key={trip.id}
                      trip={trip}
                      onAction={openAction}
                      isPending={isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((trip) => (
              <TripMobileCard
                key={trip.id}
                trip={trip}
                onAction={openAction}
                isPending={isPending}
              />
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

      {/* Action confirmation dialog */}
      {pendingAction && (
        <TripActionDialog
          action={pendingAction}
          reason={actionReason}
          onReasonChange={setActionReason}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
          isPending={isPending}
        />
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
  field: AdminTripSortBy
  label: string
  sortBy: AdminTripSortBy | undefined
  sortOrder: SortOrder
  onSort: (field: AdminTripSortBy) => void
  className?: string
}) {
  const active = sortBy === field
  const Icon = active ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
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

function TripRow({
  trip,
  onAction,
  isPending,
}: {
  trip: OrganizerTripListItem
  onAction: (type: ActionType, trip: OrganizerTripListItem) => void
  isPending: boolean
}) {
  return (
    <TableRow>
      <TableCell className="max-w-[200px]">
        <p className="truncate text-sm font-medium text-neutral-800">{trip.title}</p>
        <p className="text-xs text-neutral-500">{trip.currentBookings}/{trip.maxGroupSize} booked</p>
      </TableCell>
      <TableCell className="text-sm text-neutral-600">{trip.destination.name}</TableCell>
      <TableCell className="text-sm text-neutral-600 whitespace-nowrap">
        {formatDateRange(trip.startDate, trip.endDate)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">{formatCurrency(trip.pricePerPerson)}</TableCell>
      <TableCell>
        <Badge variant={TRIP_STATUS_VARIANT[trip.status] ?? 'outline'} className="text-xs">
          {trip.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {!trip.acceptingBookings && (
            <span className="inline-flex items-center gap-1 text-xs text-warning-600">
              {trip.bookingsPausedBy === 'ADMIN' && <Lock className="h-3 w-3" />}
              Bookings paused
            </span>
          )}
          {trip.isHidden && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              {trip.hiddenBy === 'ADMIN' && <Lock className="h-3 w-3" />}
              Hidden
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {trip.status === 'ACTIVE' && (
            <button
              onClick={() => onAction(trip.acceptingBookings ? 'pause' : 'resume', trip)}
              disabled={isPending}
              className={`text-xs font-medium px-2.5 py-1 rounded-md border disabled:opacity-50 ${
                trip.acceptingBookings
                  ? 'border-warning-300 text-warning-700 hover:bg-warning-50'
                  : 'border-success-300 text-success-700 hover:bg-success-50'
              }`}
            >
              {trip.acceptingBookings ? 'Pause Bookings' : 'Resume Bookings'}
            </button>
          )}
          <button
            onClick={() => onAction(trip.isHidden ? 'unhide' : 'hide', trip)}
            disabled={isPending}
            className={`text-xs font-medium px-2.5 py-1 rounded-md border disabled:opacity-50 ${
              trip.isHidden
                ? 'border-success-300 text-success-700 hover:bg-success-50'
                : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {trip.isHidden ? 'Make Visible' : 'Hide Trip'}
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function TripMobileCard({
  trip,
  onAction,
  isPending,
}: {
  trip: OrganizerTripListItem
  onAction: (type: ActionType, trip: OrganizerTripListItem) => void
  isPending: boolean
}) {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-800">{trip.title}</p>
          <p className="text-xs text-neutral-500">
            {trip.destination.name} &middot; {formatDateRange(trip.startDate, trip.endDate)}
          </p>
        </div>
        <Badge variant={TRIP_STATUS_VARIANT[trip.status] ?? 'outline'} className="shrink-0 text-xs">
          {trip.status}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-0 flex-wrap gap-2">
          {!trip.acceptingBookings && (
            <span className="inline-flex items-center gap-1 text-xs text-warning-600">
              {trip.bookingsPausedBy === 'ADMIN' && <Lock className="h-3 w-3" />}
              Bookings paused
            </span>
          )}
          {trip.isHidden && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              {trip.hiddenBy === 'ADMIN' && <Lock className="h-3 w-3" />}
              Hidden
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {trip.status === 'ACTIVE' && (
            <button
              onClick={() => onAction(trip.acceptingBookings ? 'pause' : 'resume', trip)}
              disabled={isPending}
              className={`min-h-[36px] text-xs font-medium px-2.5 py-1.5 rounded-md border disabled:opacity-50 ${
                trip.acceptingBookings
                  ? 'border-warning-300 text-warning-700 hover:bg-warning-50'
                  : 'border-success-300 text-success-700 hover:bg-success-50'
              }`}
            >
              {trip.acceptingBookings ? 'Pause Bookings' : 'Resume Bookings'}
            </button>
          )}
          <button
            onClick={() => onAction(trip.isHidden ? 'unhide' : 'hide', trip)}
            disabled={isPending}
            className={`min-h-[36px] text-xs font-medium px-2.5 py-1.5 rounded-md border disabled:opacity-50 ${
              trip.isHidden
                ? 'border-success-300 text-success-700 hover:bg-success-50'
                : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {trip.isHidden ? 'Make Visible' : 'Hide Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TripActionDialog({
  action,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  isPending,
}: {
  action: PendingAction
  reason: string
  onReasonChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const { type, trip } = action
  const isPause = type === 'pause'
  const isHide = type === 'hide'

  const titles: Record<ActionType, string> = {
    pause: 'Pause Bookings',
    resume: 'Resume Bookings',
    hide: 'Hide Trip',
    unhide: 'Make Trip Visible',
  }

  const descriptions: Record<ActionType, string> = {
    pause: `Pause new bookings for "${trip.title}". An optional reason will be shown publicly to travelers.`,
    resume: `Resume bookings for "${trip.title}". The paused reason will be cleared.`,
    hide: `Hide "${trip.title}" from public search and listings. An optional internal note can be added.`,
    unhide: `Make "${trip.title}" visible again in public search and listings.`,
  }

  const showReasonField = isPause || isHide
  const reasonLabel = isPause ? 'Reason (optional, shown to travelers)' : 'Note (optional, internal only)'
  const reasonPlaceholder = isPause
    ? 'e.g. Reopening after availability check…'
    : 'e.g. Under review for compliance…'

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titles[type]}</AlertDialogTitle>
          <AlertDialogDescription>{descriptions[type]}</AlertDialogDescription>
        </AlertDialogHeader>

        {showReasonField && (
          <div className="py-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              {reasonLabel}
            </label>
            <Textarea
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{reason.length}/500</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className={
              isPause || isHide
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {isPending ? 'Processing…' : titles[type]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
