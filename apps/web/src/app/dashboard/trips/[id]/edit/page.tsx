'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import { useUpdateTrip } from '@/hooks/use-update-trip'
import { TripForm } from '@/components/trips/trip-form/trip-form'
import { Spinner } from '@/components/shared/spinner'
import { ErrorState } from '@/components/shared/data-states'
import type { CreateTripDto, TripDetail } from '@shared/types/trip.types'

export default function EditTripPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const updateTrip = useUpdateTrip(id)

  const { data: trip, isLoading, error, refetch } = useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: TripDetail }>(`/trips/${id}`)
      return res.data.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Loading trip..." />
      </div>
    )
  }

  if (error || !trip) {
    return <ErrorState onRetry={() => refetch()} />
  }

  const defaultValues: Partial<CreateTripDto> = {
    title: trip.title,
    destinationId: trip.destination.id,
    tripType: trip.tripType,
    bookingMode: trip.bookingMode,
    description: trip.description,
    startDate: trip.startDate,
    endDate: trip.endDate,
    pricePerPerson: trip.pricePerPerson,
    earlyBirdPrice: trip.earlyBirdPrice ?? undefined,
    minGroupSize: trip.minGroupSize,
    maxGroupSize: trip.maxGroupSize,
    cancellationPolicy: trip.cancellationPolicy,
    inclusions: trip.inclusions,
    exclusions: trip.exclusions,
    itinerary: trip.itinerary,
    photos: trip.photos,
    pickupLocation: trip.pickupLocation ?? undefined,
    pickupTime: trip.pickupTime ?? undefined,
  }

  const handleSubmit = (data: CreateTripDto) => {
    updateTrip.mutate(data, {
      onSuccess: () => {
        router.push('/dashboard/trips')
      },
    })
  }

  return (
    <div className="animate-page-enter mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/trips" className="btn-ghost p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-bold text-neutral-900">Edit Trip</h2>
          <p className="text-sm text-neutral-500">{trip.title}</p>
        </div>
      </div>

      <div className="card-static p-4 sm:p-6">
        <TripForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isSubmitting={updateTrip.isPending}
          submitError={updateTrip.error?.message ?? null}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  )
}
