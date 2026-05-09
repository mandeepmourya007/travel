'use client'

import Link from 'next/link'
import { Users, Package, IndianRupee, Map, AlertTriangle, MessageSquare } from 'lucide-react'
import { useAdminStats } from '@/hooks/use-admin-stats'
import { StatCard, StatCardSkeleton } from '@/components/dashboard/stat-card'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { RevenueChart, RevenueChartSkeleton } from '@/components/admin/revenue-chart'
import { BookingsChart, BookingsChartSkeleton } from '@/components/admin/bookings-chart'
import { TripTypeChart, TripTypeChartSkeleton } from '@/components/admin/trip-type-chart'

export default function AdminOverviewPage() {
  const { data, isLoading, error, refetch } = useAdminStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-neutral-900">Admin Overview</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="card-static p-6">
          <div className="skeleton mb-4 h-5 w-40" />
          <RevenueChartSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-static p-6">
            <div className="skeleton mb-4 h-5 w-40" />
            <BookingsChartSkeleton />
          </div>
          <div className="card-static p-6">
            <div className="skeleton mb-4 h-5 w-40" />
            <TripTypeChartSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load admin stats"
          message={error.message || 'Something went wrong. Please try again.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <EmptyState message="No platform data available yet." />
      </div>
    )
  }

  const { overview, revenueTrend, bookingsByStatus, tripsByType } = data

  const formatCompact = (amount: number) => {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`
    return `₹${amount.toLocaleString('en-IN')}`
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-neutral-900">Admin Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={overview.totalUsers.toLocaleString('en-IN')}
          icon={<Users className="h-8 w-8" />}
        />
        <StatCard
          label="Total Bookings"
          value={overview.totalBookings.toLocaleString('en-IN')}
          icon={<Package className="h-8 w-8" />}
        />
        <StatCard
          label="Total Revenue"
          value={formatCompact(overview.totalRevenue)}
          icon={<IndianRupee className="h-8 w-8" />}
        />
        <StatCard
          label="Active Trips"
          value={overview.activeTrips}
          icon={<Map className="h-8 w-8" />}
        />
      </div>

      {/* Revenue Trend */}
      <div className="card-static p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-neutral-800">
          Revenue Trend (Last 6 Months)
        </h2>
        <RevenueChart data={revenueTrend} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-static p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-neutral-800">
            Bookings by Status
          </h2>
          <BookingsChart data={bookingsByStatus} />
        </div>
        <div className="card-static p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-neutral-800">
            Trips by Type
          </h2>
          <TripTypeChart data={tripsByType} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-static p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-neutral-800">Quick Actions</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          {overview.pendingApprovals > 0 && (
            <Link
              href="/admin/organizers"
              className="flex items-center gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-warning-100"
            >
              <AlertTriangle className="h-5 w-5" />
              <span>{overview.pendingApprovals} Pending Approval{overview.pendingApprovals !== 1 && 's'}</span>
            </Link>
          )}
          {overview.flaggedMessages > 0 && (
            <Link
              href="/admin/chat"
              className="flex items-center gap-3 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm font-medium text-error-700 transition-colors hover:bg-error-100"
            >
              <MessageSquare className="h-5 w-5" />
              <span>{overview.flaggedMessages} Flagged Message{overview.flaggedMessages !== 1 && 's'}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
