'use client'

import Link from 'next/link'
import { Map, Users, IndianRupee, Clock, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useOrganizerStats } from '@/hooks/use-organizer-stats'
import { StatCard, StatCardSkeleton } from '@/components/dashboard/stat-card'
import { ErrorState } from '@/components/shared/data-states'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: stats, isLoading, error, refetch } = useOrganizerStats()

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-neutral-900">
            Welcome back, {user?.name.split(' ')[0]}!
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Here&apos;s what&apos;s happening with your trips.
          </p>
        </div>
        <Link href="/dashboard/trips/create" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Create Trip
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : error ? (
          <div className="col-span-full">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : stats ? (
          <>
            <StatCard label="Active Trips" value={stats.activeTrips} icon={<Map className="h-6 w-6" />} />
            <StatCard label="Total Bookings" value={stats.totalBookings} icon={<Users className="h-6 w-6" />} />
            <StatCard label="Revenue" value={`₹${stats.revenue.toLocaleString('en-IN')}`} icon={<IndianRupee className="h-6 w-6" />} />
            <StatCard label="Pending Requests" value={stats.pendingRequests} icon={<Clock className="h-6 w-6" />} href="/dashboard/requests" />
          </>
        ) : (
          <div className="col-span-full card-static p-8 text-center">
            <p className="text-neutral-500">No stats available yet. Create your first trip to get started!</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/trips"
          className="card-static flex items-center gap-4 p-6 transition-shadow hover:shadow-card-hover"
        >
          <Map className="h-8 w-8 text-primary-500" />
          <div>
            <p className="font-semibold text-neutral-800">Manage Trips</p>
            <p className="text-sm text-neutral-500">View, edit, and publish your trips</p>
          </div>
        </Link>
        <Link
          href="/dashboard/trips/create"
          className="card-static flex items-center gap-4 p-6 transition-shadow hover:shadow-card-hover"
        >
          <Plus className="h-8 w-8 text-primary-500" />
          <div>
            <p className="font-semibold text-neutral-800">Create New Trip</p>
            <p className="text-sm text-neutral-500">Add a new group trip listing</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
