'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, ShieldAlert, FileWarning, Landmark } from 'lucide-react'
import Link from 'next/link'
import { useCreateTrip } from '@/hooks/use-create-trip'
import { createVehiclesForTrip } from '@/hooks/use-sync-vehicles'
import { useProfile } from '@/hooks/use-profile'
import { TripForm } from '@/components/trips/trip-form/trip-form'
import { useToast } from '@/components/shared/toast'
import { areDocsComplete } from '@/lib/organizer-utils'
import type { CreateTripDto } from '@shared/types/trip.types'
import type { CreateVehicleDto } from '@shared/types/vehicle.types'

export default function CreateTripPage() {
  const router = useRouter()
  const createTrip = useCreateTrip()
  const { toast } = useToast()
  const { data: profile, isLoading } = useProfile()

  const verificationStatus = profile?.organizerProfile?.verificationStatus
  const isApproved = verificationStatus === 'APPROVED'
  const docsComplete = areDocsComplete(profile?.organizerProfile?.documents)
  const bankLinked = profile?.organizerProfile?.bankAccountLinked ?? false

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

  const renderGate = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-40 w-full rounded-xl" />
        </div>
      )
    }

    if (!isApproved) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 p-5">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-error-600" />
          <div>
            <p className="text-sm font-semibold text-error-800">
              {verificationStatus === 'REJECTED'
                ? 'Your organizer profile was rejected'
                : 'Verification pending'}
            </p>
            <p className="mt-1 text-sm text-error-700">
              {verificationStatus === 'REJECTED'
                ? 'Your profile was not approved. Please update your profile details and contact support for re-verification before creating trips.'
                : 'Your organizer profile is under review by our admin team. You will be able to create trips once your profile is approved.'}
            </p>
            <Link
              href="/profile"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-error-700 underline underline-offset-2 hover:text-error-800"
            >
              View Profile
            </Link>
          </div>
        </div>
      )
    }

    if (!docsComplete) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-5">
          <FileWarning className="mt-0.5 h-6 w-6 shrink-0 text-warning-600" />
          <div>
            <p className="text-sm font-semibold text-warning-800">
              Verification documents required
            </p>
            <p className="mt-1 text-sm text-warning-700">
              Please upload all verification documents (Aadhaar front, Aadhaar back, and PAN card) before creating trips.
            </p>
            <Link
              href="/dashboard/settings/verification"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-warning-700 underline underline-offset-2 hover:text-warning-800"
            >
              Upload Documents
            </Link>
          </div>
        </div>
      )
    }

    if (!bankLinked) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-5">
          <Landmark className="mt-0.5 h-6 w-6 shrink-0 text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-primary-800">
              Bank account not linked
            </p>
            <p className="mt-1 text-sm text-primary-700">
              Connect your bank account via Razorpay to receive payouts. You must link a bank account before creating trips.
            </p>
            <Link
              href="/dashboard/settings/bank"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800"
            >
              Connect Bank Account
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="card-static p-4 sm:p-6">
        <TripForm
          onSubmit={handleSubmit}
          isSubmitting={createTrip.isPending}
          submitError={createTrip.error?.message ?? null}
          submitLabel="Create Trip"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/trips" className="btn-ghost p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="font-display text-2xl font-bold text-neutral-900">Create New Trip</h2>
      </div>

      {renderGate()}
    </div>
  )
}
