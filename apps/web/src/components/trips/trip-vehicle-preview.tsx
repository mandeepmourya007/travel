'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSeatMap } from '@/hooks/use-vehicle'
import { SeatGrid } from '@/components/vehicle/seat-grid'
import { SeatLegend } from '@/components/vehicle/seat-legend'
import { VehicleImageLightbox } from '@/components/vehicle/vehicle-image-lightbox'
import { Armchair, RefreshCw, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VEHICLE_ICONS } from '@shared/constants/vehicle'
import type { SeatMapResponse } from '@shared/types/vehicle.types'

// ─── Props ──────────────────────────────────────────

interface TripVehiclePreviewProps {
  tripId: string
}

// ─── Skeleton ───────────────────────────────────────

function PreviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 skeleton rounded" />
      <div className="h-48 skeleton rounded-lg" />
    </div>
  )
}

// ─── Error State ────────────────────────────────────

function PreviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl bg-error-50 border border-error-200 p-6 text-center">
      <p className="text-4xl mb-2">😕</p>
      <p className="text-sm font-semibold text-neutral-800">Failed to load vehicle layout</p>
      <p className="mt-1 text-sm text-neutral-500">This is probably temporary.</p>
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try Again
      </button>
    </div>
  )
}

// ─── Single Vehicle Panel ───────────────────────────

function VehiclePanel({ entry }: { entry: SeatMapResponse }) {
  const { vehicle, seats, summary } = entry
  const icon = VEHICLE_ICONS[vehicle.vehicleType] ?? '🚗'
  const photos = vehicle.photos ?? []
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)

  return (
    <div className="space-y-3">
      {/* Vehicle header */}
      <div className="flex items-center gap-2">
        <span className="text-lg" role="img" aria-label={vehicle.vehicleType}>
          {icon}
        </span>
        <span className="text-sm font-semibold text-neutral-700">{vehicle.label}</span>
        <span className="ml-auto text-xs text-neutral-400">
          {summary.available} of {summary.total} available
        </span>
      </div>

      {/* Vehicle photos */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={() => {
                setLightboxIdx(idx)
                setLightboxOpen(true)
              }}
              className="group relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 transition-all hover:ring-2 hover:ring-primary-400"
            >
              <Image
                src={url}
                alt={`${vehicle.label} photo ${idx + 1}`}
                fill
                sizes="128px"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                <ImageIcon className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <VehicleImageLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          photos={photos}
          initialIndex={lightboxIdx}
          vehicleName={vehicle.label}
        />
      )}

      {/* Seat grid (read-only, small size) */}
      <div className="overflow-x-auto">
        <SeatGrid
          layout={vehicle.layout}
          seats={seats}
          aisleAfterCol={vehicle.layoutConfig.aisleAfterCol}
          size="sm"
        />
      </div>

      {/* Legend */}
      <SeatLegend variant="picker" />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────

export function TripVehiclePreview({ tripId }: TripVehiclePreviewProps) {
  const { data, isLoading, error, refetch } = useSeatMap(tripId)

  if (isLoading) return <PreviewSkeleton />
  if (error) return <PreviewError onRetry={() => refetch()} />
  if (!data || data.vehicles.length === 0) return null

  return (
    <div className="space-y-6">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <Armchair className="h-5 w-5 text-primary-600" />
        <h2 className="font-display text-lg font-bold text-neutral-800 sm:text-xl">
          Vehicle & Seat Layout
        </h2>
      </div>

      {/* Vehicles */}
      <div className={cn(data.vehicles.length > 1 && 'space-y-8')}>
        {data.vehicles.map((entry) => (
          <VehiclePanel key={entry.vehicle.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
