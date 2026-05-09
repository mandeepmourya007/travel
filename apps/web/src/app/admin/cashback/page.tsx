'use client'

import { useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import Link from 'next/link'
import { Search, Gift, Users, MapPin } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import {
  useCompletedTripsForCashback,
  useCashbackByUser,
  useCashbackByTrip,
} from '@/hooks/use-admin-cashback'

type TabValue = 'issue' | 'by-user' | 'by-trip'

export default function AdminCashbackPage() {
  const [tab, setTab] = useState<TabValue>('issue')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const handleTabChange = (value: string) => {
    setTab(value as TabValue)
    setPage(1)
    setSearch('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gift className="h-7 w-7 text-primary-600" />
        <h1 className="font-display text-2xl font-bold text-neutral-900">Cashback</h1>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="issue">Issue</TabsTrigger>
          <TabsTrigger value="by-user">By User</TabsTrigger>
          <TabsTrigger value="by-trip">By Trip</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'issue' && (
        <IssueTab search={search} onSearchChange={setSearch} page={page} onPageChange={setPage} />
      )}
      {tab === 'by-user' && <ByUserTab page={page} onPageChange={setPage} />}
      {tab === 'by-trip' && <ByTripTab page={page} onPageChange={setPage} />}
    </div>
  )
}

// ─── Issue Tab ─────────────────────────────────────────

interface IssueTabProps {
  search: string
  onSearchChange: (v: string) => void
  page: number
  onPageChange: (p: number) => void
}

function IssueTab({ search, onSearchChange, page, onPageChange }: IssueTabProps) {
  const debouncedSearch = useDebounce(search, 300)
  const { data, isLoading, error, refetch } = useCompletedTripsForCashback({
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  })

  if (error) {
    return (
      <ErrorState
        title="Failed to load trips"
        message={error.message}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder="Search completed trips..."
          value={search}
          onChange={(e) => { onSearchChange(e.target.value); onPageChange(1) }}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <EmptyState message="No completed trips found." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-center">Cashback Issued</TableHead>
                  <TableHead className="text-right">Total Cashback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>
                      <Link
                        href={`/admin/cashback/${trip.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {trip.title}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">{trip.currentBookings}</TableCell>
                    <TableCell className="text-center">
                      {trip.cashbackStats.issuedCount > 0 ? (
                        <Badge variant="secondary">{trip.cashbackStats.issuedCount} issued</Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trip.cashbackStats.totalAmount > 0
                        ? `₹${trip.cashbackStats.totalAmount.toLocaleString('en-IN')}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((trip) => (
              <Link
                key={trip.id}
                href={`/admin/cashback/${trip.id}`}
                className="card-static block p-4"
              >
                <p className="font-medium text-primary-700">{trip.title}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}
                </p>
                <div className="mt-2 flex items-center gap-4 text-sm text-neutral-600">
                  <span>{trip.currentBookings} bookings</span>
                  {trip.cashbackStats.issuedCount > 0 && (
                    <Badge variant="secondary">{trip.cashbackStats.issuedCount} issued</Badge>
                  )}
                  {trip.cashbackStats.totalAmount > 0 && (
                    <span className="font-mono">₹{trip.cashbackStats.totalAmount.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}

// ─── By User Tab ─────────────────────────────────────

interface PaginatedTabProps {
  page: number
  onPageChange: (p: number) => void
}

function ByUserTab({ page, onPageChange }: PaginatedTabProps) {
  const { data, isLoading, error, refetch } = useCashbackByUser({ page, limit: 20 })

  if (error) {
    return <ErrorState title="Failed to load" message={error.message} onRetry={() => refetch()} />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!data?.data.length) {
    return <EmptyState message="No cashback issued yet." />
  }

  return (
    <div className="space-y-4">
      {/* Desktop */}
      <div className="hidden md:block">
        <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-center">Times Issued</TableHead>
              <TableHead className="text-right">Total Cashback</TableHead>
              <TableHead className="text-right">Last Issued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((row) => (
              <TableRow key={row.userId}>
                <TableCell>
                  <Link
                    href={`/admin/cashback/user/${row.userId}`}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    {row.userName}
                  </Link>
                  {row.email && (
                    <p className="text-xs text-neutral-500">{row.email}</p>
                  )}
                </TableCell>
                <TableCell className="text-center">{row.count}</TableCell>
                <TableCell className="text-right font-mono">
                  ₹{row.totalCashback.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-right text-sm text-neutral-500">
                  {new Date(row.latestIssuedAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {data.data.map((row) => (
          <Link
            key={row.userId}
            href={`/admin/cashback/user/${row.userId}`}
            className="card-static block p-4"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-400" />
              <span className="font-medium text-primary-700">{row.userName}</span>
            </div>
            {row.email && <p className="mt-0.5 text-xs text-neutral-500">{row.email}</p>}
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-neutral-600">{row.count} times</span>
              <span className="font-mono font-semibold">₹{row.totalCashback.toLocaleString('en-IN')}</span>
            </div>
          </Link>
        ))}
      </div>

      <Pagination
        currentPage={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        onPageChange={onPageChange}
      />
    </div>
  )
}

// ─── By Trip Tab ─────────────────────────────────────

function ByTripTab({ page, onPageChange }: PaginatedTabProps) {
  const { data, isLoading, error, refetch } = useCashbackByTrip({ page, limit: 20 })

  if (error) {
    return <ErrorState title="Failed to load" message={error.message} onRetry={() => refetch()} />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!data?.data.length) {
    return <EmptyState message="No cashback issued yet." />
  }

  return (
    <div className="space-y-4">
      {/* Desktop */}
      <div className="hidden md:block">
        <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip</TableHead>
              <TableHead className="text-center">Travelers</TableHead>
              <TableHead className="text-right">Total Cashback</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((row) => (
              <TableRow key={row.tripId}>
                <TableCell>
                  <p className="font-medium text-neutral-900">{row.tripTitle}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(row.startDate).toLocaleDateString()} – {new Date(row.endDate).toLocaleDateString()}
                  </p>
                </TableCell>
                <TableCell className="text-center">{row.travelerCount}</TableCell>
                <TableCell className="text-right font-mono">
                  ₹{row.totalCashback.toLocaleString('en-IN')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {data.data.map((row) => (
          <div key={row.tripId} className="card-static p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-neutral-400" />
              <span className="font-medium text-neutral-900">{row.tripTitle}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {new Date(row.startDate).toLocaleDateString()} – {new Date(row.endDate).toLocaleDateString()}
            </p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-neutral-600">{row.travelerCount} travelers</span>
              <span className="font-mono font-semibold">₹{row.totalCashback.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ))}
      </div>

      <Pagination
        currentPage={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        onPageChange={onPageChange}
      />
    </div>
  )
}
