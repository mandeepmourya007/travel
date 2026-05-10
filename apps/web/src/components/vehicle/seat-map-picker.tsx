'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSeatMap } from '@/hooks/use-vehicle'
import { SeatGrid } from './seat-grid'
import { SeatLegend } from './seat-legend'
import { AlertCircle, RefreshCw, Car } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VehicleSeatItem, SeatMapResponse } from '@shared/types/vehicle.types'

// ─── Props ──────────────────────────────────────────

interface SeatMapPickerProps {
  tripId: string
  maxSeats: number
  onSelectionChange: (seatIds: string[]) => void
}

// ─── Vehicle icon mapping ───────────────────────────

const VEHICLE_ICONS: Record<string, string> = {
  SEDAN: '🚗',
  ERTIGA: '🚙',
  INNOVA: '🚙',
  TEMPO: '🚐',
  MINIBUS: '🚌',
  BUS: '🚌',
  CUSTOM: '🚗',
}

// ─── Skeleton ───────────────────────────────────────

function SeatMapPickerSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 w-full skeleton rounded-lg" />
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 skeleton rounded-lg" />
        <div className="h-4 w-24 skeleton rounded" />
        <div className="h-5 w-20 skeleton rounded-full ml-auto" />
      </div>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-col items-center gap-1.5">
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex gap-1.5">
              <div className="h-11 w-5 skeleton rounded" />
              {Array.from({ length: 4 }).map((_, c) => (
                <div key={c} className="h-11 w-11 skeleton rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-16 skeleton rounded" />
        ))}
      </div>
    </div>
  )
}

// ─── Error State ────────────────────────────────────

function SeatMapPickerError({ onRetry }: { onRetry: () => void }) {
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

function SeatMapPickerEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Car className="h-8 w-8 text-neutral-300" />
      <p className="text-sm text-neutral-500">No seat layout configured for this trip</p>
    </div>
  )
}

// ─── Single Vehicle Seat Grid ───────────────────────

interface VehicleSeatPanelProps {
  entry: SeatMapResponse
  selectedIds: Set<string>
  selectionOrder: string[]
  onSeatClick: (seat: VehicleSeatItem) => void
}

function VehicleSeatPanel({ entry, selectedIds, selectionOrder, onSeatClick }: VehicleSeatPanelProps) {
  const { vehicle, seats, summary } = entry
  const icon = VEHICLE_ICONS[vehicle.vehicleType] ?? '🚗'

  return (
    <div className="space-y-3">
      {/* Vehicle header (matches preview.html .vehicle-header) */}
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
        <span className="text-xl leading-none">{icon}</span>
        <span className="text-base font-bold text-neutral-800 font-display">
          {vehicle.label}
        </span>
        <span className="ml-auto inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
          {summary.available} available
        </span>
      </div>

      {/* Grid */}
      <SeatGrid
        layout={vehicle.layout}
        seats={seats}
        aisleAfterCol={vehicle.layoutConfig.aisleAfterCol}
        selectedSeatIds={selectedIds}
        selectionOrder={selectionOrder}
        size="md"
        onSeatClick={onSeatClick}
      />

      {/* Legend */}
      <SeatLegend variant="picker" />
    </div>
  )
}

// ─── Component ──────────────────────────────────────

export function SeatMapPicker({ tripId, maxSeats, onSelectionChange }: SeatMapPickerProps) {
  const { data, isLoading, error, refetch } = useSeatMap(tripId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectionOrderRef = useRef<string[]>([])
  const [activeVehicleIdx, setActiveVehicleIdx] = useState(0)

  const handleSeatClick = useCallback((seat: VehicleSeatItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(seat.id)) {
        next.delete(seat.id)
        selectionOrderRef.current = selectionOrderRef.current.filter((id) => id !== seat.id)
      } else if (next.size < maxSeats) {
        next.add(seat.id)
        if (!selectionOrderRef.current.includes(seat.id)) {
          selectionOrderRef.current = [...selectionOrderRef.current, seat.id]
        }
      }
      const ids = Array.from(next)
      onSelectionChange(ids)
      return next
    })
  }, [maxSeats, onSelectionChange])

  // Reset active vehicle when data changes (e.g. refetch)
  useEffect(() => {
    if (data && activeVehicleIdx >= data.vehicles.length) {
      setActiveVehicleIdx(0)
    }
  }, [data, activeVehicleIdx])

  if (isLoading) return <SeatMapPickerSkeleton />
  if (error) return <SeatMapPickerError onRetry={() => refetch()} />
  if (!data || data.vehicles.length === 0) return <SeatMapPickerEmpty />

  const vehicles = data.vehicles
  const isMultiVehicle = vehicles.length > 1
  const activeEntry = vehicles[activeVehicleIdx]

  // Aggregate counts across all vehicles
  const totalSelected = selectedIds.size
  const allSelected = totalSelected === maxSeats

  // Build a flat list of all seats across vehicles for the selection summary
  const allSeats = vehicles.flatMap((v) => v.seats)

  return (
    <div className="space-y-3">
      {/* Info bar (matches preview.html .seat-picker-info) */}
      <div className={cn(
        'rounded-lg px-4 py-2.5 text-[13px] font-medium',
        allSelected
          ? 'bg-success-50 text-success-500 border border-emerald-200'
          : 'bg-info-50 text-info-500 border border-blue-200',
      )}>
        {allSelected
          ? `All ${maxSeats} seat${maxSeats > 1 ? 's' : ''} selected — you're all set!`
          : <>Select <strong>{maxSeats}</strong> seat{maxSeats > 1 ? 's' : ''} for your travelers. Click a green seat to select.</>
        }
      </div>

      {/* Vehicle tabs — only when >1 vehicle (matches preview.html .seat-section-tabs) */}
      {isMultiVehicle && (
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 w-fit">
          {vehicles.map((v, idx) => {
            const icon = VEHICLE_ICONS[v.vehicle.vehicleType] ?? '🚗'
            const selectedInVehicle = v.seats.filter((s) => selectedIds.has(s.id)).length
            return (
              <button
                key={v.vehicle.id}
                type="button"
                onClick={() => setActiveVehicleIdx(idx)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all duration-150',
                  idx === activeVehicleIdx
                    ? 'bg-white text-neutral-900 font-semibold shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700',
                )}
              >
                <span className="text-base leading-none">{icon}</span>
                <span>{v.vehicle.label}</span>
                {selectedInVehicle > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1">
                    {selectedInVehicle}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Active vehicle seat panel */}
      {activeEntry && (
        <VehicleSeatPanel
          entry={activeEntry}
          selectedIds={selectedIds}
          selectionOrder={selectionOrderRef.current}
          onSeatClick={handleSeatClick}
        />
      )}

      {/* Selection summary (matches preview.html .seat-summary) */}
      <div className="flex flex-wrap gap-4 text-[13px] text-neutral-600">
        <span>Selected: <strong className="text-neutral-800">{totalSelected}/{maxSeats}</strong></span>
        {isMultiVehicle && (
          <span>Across: <strong className="text-neutral-800">{vehicles.filter((v) => v.seats.some((s) => selectedIds.has(s.id))).length} vehicle{vehicles.filter((v) => v.seats.some((s) => selectedIds.has(s.id))).length !== 1 ? 's' : ''}</strong></span>
        )}
      </div>

      {/* Seat chips */}
      {totalSelected > 0 && (
        <div className="rounded-lg border border-neutral-100 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500 mb-2">
            Your seats ({totalSelected}/{maxSeats})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectionOrderRef.current.filter((id) => selectedIds.has(id)).map((id, idx) => {
              const seat = allSeats.find((s) => s.id === id)
              const parentVehicle = isMultiVehicle
                ? vehicles.find((v) => v.seats.some((s) => s.id === id))
                : undefined
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 border border-primary-200"
                >
                  T{idx + 1}: Seat {seat?.seatNumber ?? seat?.seatLabel}
                  {parentVehicle && (
                    <span className="text-primary-400">({parentVehicle.vehicle.label})</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
