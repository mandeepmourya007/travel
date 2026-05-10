'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import { useUpdateTrip } from '@/hooks/use-update-trip'
import { useOrganizerVehicles } from '@/hooks/use-vehicle'
import { useSyncVehicles } from '@/hooks/use-sync-vehicles'
import { TripForm } from '@/components/trips/trip-form/trip-form'
import { Spinner } from '@/components/shared/spinner'
import { ErrorState } from '@/components/shared/data-states'
import type { CreateTripDto, TripDetail } from '@shared/types/trip.types'
import type { CreateVehicleDto } from '@shared/types/vehicle.types'

function toDateTimeLocal(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (isNaN(d.getTime())) return undefined
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditTripPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const updateTrip = useUpdateTrip(id)
  const { data: existingVehicles } = useOrganizerVehicles(id)
  const { syncVehicles } = useSyncVehicles({ tripId: id, existingVehicles })

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
    return <ErrorState title="Failed to load trip" message={error?.message || 'Could not load trip details for editing. Please try again.'} onRetry={() => refetch()} />
  }

  const defaultValues: Partial<CreateTripDto> = {
    title: trip.title,
    destinationId: trip.destination.id,
    tripType: trip.tripType,
    bookingMode: trip.bookingMode,
    description: trip.description,
    startDate: toDateTimeLocal(trip.startDate) ?? '',
    endDate: toDateTimeLocal(trip.endDate) ?? '',
    pricePerPerson: trip.pricePerPerson,
    earlyBirdPrice: trip.earlyBirdPrice ?? undefined,
    earlyBirdDeadline: toDateTimeLocal(trip.earlyBirdDeadline),
    bookingDeadline: toDateTimeLocal(trip.bookingDeadline),
    minGroupSize: trip.minGroupSize,
    maxGroupSize: trip.maxGroupSize,
    cancellationPolicy: trip.cancellationPolicy,
    inclusions: trip.inclusions,
    exclusions: trip.exclusions,
    itinerary: trip.itinerary,
    photos: trip.photos,
    pickupPoints: trip.pickupPoints.map((p) => ({
      label: p.label,
      address: p.address ?? undefined,
      time: p.time ?? undefined,
      extraCharge: p.extraCharge,
    })),
    dropPoints: trip.dropPoints.map((p) => ({
      label: p.label,
      address: p.address ?? undefined,
      time: p.time ?? undefined,
      extraCharge: p.extraCharge,
    })),
  }

  const handleSubmit = (data: CreateTripDto, newVehicleData?: CreateVehicleDto[]) => {
    updateTrip.mutate(data, {
      onSuccess: async () => {
        await syncVehicles(newVehicleData)
        router.push('/dashboard/trips')
      },
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
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
          initialVehicleData={existingVehicles && existingVehicles.length > 0
            ? existingVehicles.map((v) => ({
                label: v.label,
                vehicleType: v.vehicleType as CreateVehicleDto['vehicleType'],
                layoutConfig: v.layoutConfig,
                layout: v.layout,
              }))
            : null
          }
        />
      </div>
    </div>
  )
}
