'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { useAdminTravellers } from '@/hooks/use-admin-travellers'
import { useAdminOrganizerDirectory } from '@/hooks/use-admin-organizer-directory'
import { cn } from '@/lib/utils'
import { SORT_ORDER } from '@shared/constants/sort'
import { ADMIN_TRAVELLER_SORT, ADMIN_ORGANIZER_SORT, ADMIN_TRAVELLER_STATUS } from '@shared/constants/admin'
import { VERIFICATION_STATUS } from '@shared/constants/verification-status'
import type { SortOrder, AdminTravellerSort, AdminOrganizerSort, AdminTravellerStatus, VerificationStatusFilter } from '@shared/types/admin.types'

const TRAVELLER_STATUS_OPTIONS: { value: 'all' | AdminTravellerStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: ADMIN_TRAVELLER_STATUS.ACTIVE, label: 'Active' },
  { value: ADMIN_TRAVELLER_STATUS.INACTIVE, label: 'Inactive' },
]

const ORGANIZER_STATUS_OPTIONS: { value: 'all' | VerificationStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: VERIFICATION_STATUS.PENDING, label: 'Pending' },
  { value: VERIFICATION_STATUS.APPROVED, label: 'Approved' },
  { value: VERIFICATION_STATUS.REJECTED, label: 'Rejected' },
  { value: VERIFICATION_STATUS.REVISION_REQUIRED, label: 'Revision Required' },
]

const TAB = { TRAVELLERS: 'travellers', ORGANIZERS: 'organizers' } as const
type TabValue = (typeof TAB)[keyof typeof TAB]

export default function AdminUsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabValue = tabParam === TAB.ORGANIZERS ? TAB.ORGANIZERS : TAB.TRAVELLERS

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.push(`/admin/users?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-neutral-900">Users</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value={TAB.TRAVELLERS}>Traveller Directory</TabsTrigger>
          <TabsTrigger value={TAB.ORGANIZERS}>Organizer Directory</TabsTrigger>
        </TabsList>
        <TabsContent value={TAB.TRAVELLERS} className="mt-4">
          <TravellerDirectoryTab />
        </TabsContent>
        <TabsContent value={TAB.ORGANIZERS} className="mt-4">
          <OrganizerDirectoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TravellerDirectoryTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<AdminTravellerSort | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<SortOrder>(SORT_ORDER.DESC)
  const debouncedSearch = useDebounce(search, 300)

  function handleSort(field: AdminTravellerSort) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === SORT_ORDER.ASC ? SORT_ORDER.DESC : SORT_ORDER.ASC))
    } else {
      setSortBy(field)
      setSortOrder(SORT_ORDER.DESC)
    }
    setPage(1)
  }

  const { data, isLoading, error, refetch } = useAdminTravellers({
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : (status as AdminTravellerStatus),
    sortBy,
    sortOrder: sortBy ? sortOrder : undefined,
    page,
    limit: 20,
  })

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <ErrorState
          title="Failed to load travellers"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SearchStatusFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by name, email, or phone..."
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1) }}
        statusOptions={TRAVELLER_STATUS_OPTIONS}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : !data?.data.length ? (
        <EmptyState message="No travellers match your filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead field={ADMIN_TRAVELLER_SORT.NAME} label="Name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <SortableHead field={ADMIN_TRAVELLER_SORT.BOOKINGS_COUNT} label="Trips Booked" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((traveller) => (
                    <TableRow key={traveller.id}>
                      <TableCell className="font-medium text-neutral-900">{traveller.name}</TableCell>
                      <TableCell className="text-sm text-neutral-600">{traveller.email ?? '—'}</TableCell>
                      <TableCell className="text-sm text-neutral-600">{traveller.phone ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{traveller.bookingsCount}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/users/travellers/${traveller.id}`}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          View →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((traveller) => (
              <Link
                key={traveller.id}
                href={`/admin/users/travellers/${traveller.id}`}
                className="card block space-y-2 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{traveller.name}</span>
                  <span className="text-sm font-medium text-primary-600">View →</span>
                </div>
                <p className="text-sm text-neutral-500">{traveller.email ?? '—'}</p>
                <div className="flex items-center justify-between text-sm text-neutral-500">
                  <span>{traveller.phone ?? '—'}</span>
                  <span className="font-mono">{traveller.bookingsCount} trips</span>
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

function OrganizerDirectoryTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<AdminOrganizerSort | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<SortOrder>(SORT_ORDER.DESC)
  const debouncedSearch = useDebounce(search, 300)

  function handleSort(field: AdminOrganizerSort) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === SORT_ORDER.ASC ? SORT_ORDER.DESC : SORT_ORDER.ASC))
    } else {
      setSortBy(field)
      setSortOrder(SORT_ORDER.DESC)
    }
    setPage(1)
  }

  const { data, isLoading, error, refetch } = useAdminOrganizerDirectory({
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : (status as VerificationStatusFilter),
    sortBy,
    sortOrder: sortBy ? sortOrder : undefined,
    page,
    limit: 20,
  })

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <ErrorState
          title="Failed to load organizers"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SearchStatusFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by name, email, or business name..."
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1) }}
        statusOptions={ORGANIZER_STATUS_OPTIONS}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : !data?.data.length ? (
        <EmptyState message="No organizers match your filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead field={ADMIN_ORGANIZER_SORT.NAME} label="Name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                    <TableHead>Email</TableHead>
                    <TableHead>Business Name</TableHead>
                    <SortableHead field={ADMIN_ORGANIZER_SORT.TRIPS_COUNT} label="Trips Created" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="text-right" />
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((organizer) => (
                    <TableRow key={organizer.id}>
                      <TableCell className="font-medium text-neutral-900">{organizer.name}</TableCell>
                      <TableCell className="text-sm text-neutral-600">{organizer.email ?? '—'}</TableCell>
                      <TableCell className="text-sm text-neutral-600">{organizer.businessName}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{organizer.tripsCount}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/users/organizers/${organizer.id}`}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          View →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((organizer) => (
              <Link
                key={organizer.id}
                href={`/admin/users/organizers/${organizer.id}`}
                className="card block space-y-2 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{organizer.name}</span>
                  <span className="text-sm font-medium text-primary-600">View →</span>
                </div>
                <p className="text-sm text-neutral-500">{organizer.email ?? '—'}</p>
                <div className="flex items-center justify-between text-sm text-neutral-500">
                  <span>{organizer.businessName}</span>
                  <span className="font-mono">{organizer.tripsCount} trips</span>
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

function TableSkeleton() {
  return (
    <TableContainer>
      <div className="space-y-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3.5">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-48 flex-1" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-12" />
          </div>
        ))}
      </div>
    </TableContainer>
  )
}

function SearchStatusFilterBar<TStatus extends string>({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  statusOptions,
}: {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  status: string
  onStatusChange: (value: string) => void
  statusOptions: { value: 'all' | TStatus; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SortableHead<TField extends string>({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  className,
}: {
  field: TField
  label: string
  sortBy: TField | undefined
  sortOrder: SortOrder
  onSort: (field: TField) => void
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
