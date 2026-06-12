'use client'

import { useOrganizerSeatMap } from '@/hooks/use-vehicle'
import { SeatGrid } from './seat-grid'
import { SeatLegend } from './seat-legend'
import { AlertCircle, RefreshCw, Users } from 'lucide-react'
import type { SeatMapResponse } from '@shared/types/vehicle.types'
import { VEHICLE_ICONS } from '@shared/constants/vehicle'

// ─── Props ──────────────────────────────────────────

interface SeatMapViewerProps {
  tripId: string
}

// ─── Skeleton ───────────────────────────────────────

function SeatMapViewerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 skeleton rounded" />
      <div className="flex flex-col items-center gap-2">
        {Array.from({ length: 4 }).map((_, r) => (
          <div key={r} className="flex gap-2">
            {Array.from({ length: 3 }).map((_, c) => (
              <div key={c} className="h-11 w-11 skeleton rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Error State ────────────────────────────────────

function SeatMapViewerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertCircle className="h-8 w-8 text-error-500" />
      <p className="text-sm text-neutral-600">Failed to load seat map</p>
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

function SeatMapViewerEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Users className="h-8 w-8 text-neutral-400" />
      <p className="text-sm text-neutral-500">No vehicle configured yet</p>
      <p className="text-xs text-neutral-400">Add a vehicle layout to enable seat selection</p>
    </div>
  )
}

// ─── Single Vehicle Panel ───────────────────────────

function VehicleViewerPanel({ entry }: { entry: SeatMapResponse }) {
  const { vehicle, seats, summary } = entry
  const icon = VEHICLE_ICONS[vehicle.vehicleType] ?? '🚗'
  const photos = vehicle.photos ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold font-display text-neutral-800 flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          {vehicle.label} — Seat Map
        </h3>
        <div className="flex gap-3 text-xs font-mono text-neutral-500">
          <span className="text-success-700">{summary.available} available</span>
          <span className="text-primary-700">{summary.booked} booked</span>
          <span className="text-highlight-700">{summary.held} held</span>
        </div>
      </div>

      {/* Vehicle photo thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, idx) => (
            <div
              key={url}
              className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100"
            >
              <img
                src={url}
                alt={`${vehicle.label} photo ${idx + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto py-2">
        <SeatGrid
          layout={vehicle.layout}
          seats={seats}
          aisleAfterCol={vehicle.layoutConfig.aisleAfterCol}
          size="md"
        />
      </div>

      {/* Booked Seats Table (mobile: stacked cards) */}
      {summary.booked > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            Booked Seats
          </h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {seats
              .filter((s) => s.status === 'BOOKED' && s.travelerName)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
                >
                  <span className="font-mono text-sm font-bold text-primary-700">{s.seatLabel}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-800">{s.travelerName}</p>
                    {s.bookingRef && (
                      <p className="text-xs text-neutral-400 font-mono">{s.bookingRef}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <SeatLegend variant="full" />
    </div>
  )
}

// ─── Component ──────────────────────────────────────

export function SeatMapViewer({ tripId }: SeatMapViewerProps) {
  const { data, isLoading, error, refetch } = useOrganizerSeatMap(tripId)

  if (isLoading) return <SeatMapViewerSkeleton />
  if (error) return <SeatMapViewerError onRetry={() => refetch()} />
  if (!data || data.vehicles.length === 0) return <SeatMapViewerEmpty />

  return (
    <div className="space-y-8">
      {data.vehicles.map((entry) => (
        <VehicleViewerPanel key={entry.vehicle.id} entry={entry} />
      ))}
    </div>
  )
}
