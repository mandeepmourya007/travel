'use client'

import Link from 'next/link'
import { Plus, SearchX } from 'lucide-react'
import { useMyTrips } from '@/hooks/use-my-trips'
import { usePublishTrip } from '@/hooks/use-publish-trip'
import { useDeleteTrip } from '@/hooks/use-delete-trip'
import { useToggleBookings } from '@/hooks/use-toggle-bookings'
import { TripListCard, TripListCardSkeleton } from '@/components/dashboard/trip-list-card'
import { ErrorState, EmptyState } from '@/components/shared/data-states'

export default function MyTripsPage() {
  const { data: trips, isLoading, error, refetch } = useMyTrips()
  const publishTrip = usePublishTrip()
  const deleteTrip = useDeleteTrip()
  const toggleBookings = useToggleBookings()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-10 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <TripListCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-neutral-900">My Trips</h2>
        <Link href="/dashboard/trips/create" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Create Trip
        </Link>
      </div>

      {!trips || trips.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            message="You haven't created any trips yet."
            icon={<SearchX className="mx-auto h-12 w-12 text-neutral-300" />}
            action={
              <Link href="/dashboard/trips/create" className="btn-primary text-sm">
                Create Your First Trip
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {trips.map((trip) => (
            <TripListCard
              key={trip.id}
              trip={trip}
              onPublish={(id) => publishTrip.mutate(id)}
              onDelete={(id) => deleteTrip.mutate(id)}
              onToggleBookings={(id) => toggleBookings.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
