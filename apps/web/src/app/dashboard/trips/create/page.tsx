'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useCreateTrip } from '@/hooks/use-create-trip'
import { createVehiclesForTrip } from '@/hooks/use-sync-vehicles'
import { TripForm } from '@/components/trips/trip-form/trip-form'
import { useToast } from '@/components/shared/toast'
import type { CreateTripDto } from '@shared/types/trip.types'
import type { CreateVehicleDto } from '@shared/types/vehicle.types'

export default function CreateTripPage() {
  const router = useRouter()
  const createTrip = useCreateTrip()
  const { toast } = useToast()

  const handleSubmit = (data: CreateTripDto, vehicleData?: CreateVehicleDto[]) => {
    createTrip.mutate(data, {
      onSuccess: async (trip) => {
        if (vehicleData && vehicleData.length > 0 && trip.id) {
          try {
            await createVehiclesForTrip(trip.id, vehicleData)
          } catch {
            toast({ variant: 'error', title: 'Trip created but vehicle setup failed. Configure it from the Seats tab.' })
          }
        }
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
        <h2 className="font-display text-2xl font-bold text-neutral-900">Create New Trip</h2>
      </div>

      <div className="card-static p-4 sm:p-6">
        <TripForm
          onSubmit={handleSubmit}
          isSubmitting={createTrip.isPending}
          submitError={createTrip.error?.message ?? null}
          submitLabel="Create Trip"
        />
      </div>
    </div>
  )
}
