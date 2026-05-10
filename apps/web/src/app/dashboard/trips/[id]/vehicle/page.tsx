'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useOrganizerSeatMap, useCreateVehicle, useDeleteVehicle } from '@/hooks/use-vehicle'
import { SeatLayoutBuilder } from '@/components/vehicle/seat-layout-builder'
import { SeatMapViewer } from '@/components/vehicle/seat-map-viewer'
import { ArrowLeft, Trash2, AlertCircle, RefreshCw, Truck } from 'lucide-react'
import { useLogError } from '@/hooks/use-log-error'
import type { CreateVehicleDto } from '@shared/types/vehicle.types'

// ─── Skeleton ───────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 skeleton rounded" />
      <div className="h-64 skeleton rounded-xl" />
    </div>
  )
}

// ─── Error State ────────────────────────────────────

function PageError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  useLogError(error)
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertCircle className="h-10 w-10 text-error-500" />
      <p className="text-sm text-neutral-600">Failed to load vehicle data</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────

function NoVehicle({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
      <Truck className="h-12 w-12 text-neutral-400" />
      <div>
        <h3 className="text-base font-semibold text-neutral-700">No vehicle configured</h3>
        <p className="mt-1 text-sm text-neutral-500">Add a vehicle to enable seat selection for travelers</p>
      </div>
      <button
        onClick={onAdd}
        className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
      >
        Add Vehicle Layout
      </button>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────

export default function VehicleManagePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const tripId = params.id

  const { data, isLoading, error, refetch } = useOrganizerSeatMap(tripId)
  const createVehicle = useCreateVehicle(tripId)
  const deleteVehicle = useDeleteVehicle(tripId)

  const [mode, setMode] = useState<'view' | 'create'>('view')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreate = (dto: CreateVehicleDto) => {
    createVehicle.mutate(dto, {
      onSuccess: () => setMode('view'),
    })
  }

  const handleDelete = () => {
    const firstVehicle = data?.vehicles?.[0]
    if (!firstVehicle?.vehicle?.id) return
    if (!window.confirm('Delete this vehicle layout? All seat assignments will be removed.')) return

    setIsDeleting(true)
    deleteVehicle.mutate(firstVehicle.vehicle.id, {
      onSettled: () => setIsDeleting(false),
    })
  }

  if (isLoading) return <PageSkeleton />
  if (error) return <PageError error={error} onRetry={() => refetch()} />

  const hasVehicle = !!data && data.vehicles.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/trips/${tripId}`)}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Back to trip"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-display font-bold text-neutral-800 sm:text-xl">
            Vehicle & Seat Layout
          </h1>
        </div>

        {hasVehicle && mode === 'view' && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-error-300 px-3 py-1.5 text-sm font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Remove Vehicle'}
          </button>
        )}
      </div>

      {/* Content */}
      {mode === 'create' || !hasVehicle ? (
        hasVehicle ? null : mode === 'view' ? (
          <NoVehicle onAdd={() => setMode('create')} />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
            <SeatLayoutBuilder
              onSave={handleCreate}
              isSaving={createVehicle.isPending}
            />
          </div>
        )
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
          <SeatMapViewer tripId={tripId} />
        </div>
      )}
    </div>
  )
}
