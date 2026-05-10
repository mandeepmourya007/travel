'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Armchair, Info, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { SeatLayoutBuilder } from '@/components/vehicle/seat-layout-builder'
import type { CreateVehicleDto } from '@shared/types/vehicle.types'

const MAX_VEHICLES = 5

interface VehicleEntry {
  /** Temp client-side id for keying */
  key: string
  data: CreateVehicleDto | null
  saved: boolean
  collapsed: boolean
}

interface VehicleTabProps {
  initialEnabled?: boolean
  initialVehicleData?: CreateVehicleDto[] | null
  onVehicleChange: (data: CreateVehicleDto[] | null) => void
}

let keyCounter = 0
function genKey() { return `vk-${++keyCounter}-${Date.now()}` }

export function VehicleTab({ initialEnabled = false, initialVehicleData, onVehicleChange }: VehicleTabProps) {
  const [enabled, setEnabled] = useState(initialEnabled)

  const [vehicles, setVehicles] = useState<VehicleEntry[]>(() => {
    if (initialVehicleData && initialVehicleData.length > 0) {
      return initialVehicleData.map((d) => ({
        key: genKey(),
        data: d,
        saved: true,
        collapsed: true,
      }))
    }
    return [{ key: genKey(), data: null, saved: false, collapsed: false }]
  })

  // Stable ref for parent callback — avoids re-creating every handler on each render
  const onChangeRef = useRef(onVehicleChange)
  useEffect(() => { onChangeRef.current = onVehicleChange })

  useEffect(() => {
    if (initialVehicleData && initialEnabled) {
      setEnabled(true)
    }
  }, [initialVehicleData, initialEnabled])

  // Sync vehicle data to parent whenever `vehicles` changes (skip initial mount)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    const saved = vehicles.filter((e) => e.data !== null).map((e) => e.data as CreateVehicleDto)
    onChangeRef.current(saved.length > 0 ? saved : null)
  }, [vehicles])

  const handleToggle = useCallback((checked: boolean) => {
    setEnabled(checked)
    if (!checked) {
      onChangeRef.current(null)
      setVehicles([{ key: genKey(), data: null, saved: false, collapsed: false }])
    }
  }, [])

  const handleSave = useCallback((index: number, dto: CreateVehicleDto) => {
    setVehicles((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], data: dto, saved: true, collapsed: true }
      return next
    })
  }, [])

  const handleRemove = useCallback((index: number) => {
    setVehicles((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) next.push({ key: genKey(), data: null, saved: false, collapsed: false })
      return next
    })
  }, [])

  const handleAdd = useCallback(() => {
    setVehicles((prev) => [
      ...prev.map((e) => ({ ...e, collapsed: true })),
      { key: genKey(), data: null, saved: false, collapsed: false },
    ])
  }, [])

  const toggleCollapse = useCallback((index: number) => {
    setVehicles((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], collapsed: !next[index].collapsed }
      return next
    })
  }, [])

  const totalSeats = vehicles.reduce((sum, e) => {
    if (!e.data) return sum
    return sum + e.data.layout.flat().filter((c) => c === 'SEAT').length
  }, 0)

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <Armchair className="mt-0.5 h-6 w-6 shrink-0 text-primary-600" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Enable Seat Selection</h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Travelers can pick specific seats when booking this trip
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => handleToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-neutral-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
            </label>
          </div>
        </div>
      </div>

      {/* Info banner when disabled */}
      {!enabled && (
        <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
          <div className="text-sm text-neutral-500">
            <p>Seat selection is <strong className="text-neutral-700">optional</strong>. Enable it if your trip includes a dedicated vehicle (bus, tempo traveller, innova, etc.) and you want travelers to choose their seats.</p>
            <p className="mt-2">You can also configure this later from the trip dashboard.</p>
          </div>
        </div>
      )}

      {/* Vehicle list when enabled */}
      {enabled && (
        <div className="space-y-4">
          {/* Summary bar */}
          {vehicles.some((e) => e.saved) && (
            <div className="flex items-center justify-between rounded-lg border border-success-500/20 bg-success-50 px-4 py-2.5 text-sm text-success-500">
              <div className="flex items-center gap-2">
                <Armchair className="h-4 w-4" />
                {vehicles.filter((e) => e.saved).length} vehicle{vehicles.filter((e) => e.saved).length !== 1 ? 's' : ''} configured — {totalSeats} total seats
              </div>
            </div>
          )}

          {/* Vehicle entries */}
          {vehicles.map((entry, idx) => (
            <div key={entry.key} className="rounded-xl border border-neutral-200 bg-white">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleCollapse(idx)}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-800"
                >
                  {entry.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  {entry.data?.label || `Vehicle ${idx + 1}`}
                  {entry.saved && (
                    <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-500">
                      Saved
                    </span>
                  )}
                  {!entry.saved && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                      Unsaved
                    </span>
                  )}
                </button>
                {vehicles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-500 transition-colors hover:border-error-500/30 hover:bg-error-50 hover:text-error-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>

              {/* Builder */}
              {!entry.collapsed && (
                <div className="p-4 sm:p-6">
                  <SeatLayoutBuilder
                    initialLayout={entry.data?.layout}
                    initialConfig={entry.data?.layoutConfig}
                    initialVehicleType={entry.data?.vehicleType}
                    initialLabel={entry.data?.label}
                    onSave={(dto) => handleSave(idx, dto)}
                    isSaving={false}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add vehicle button */}
          {vehicles.length < MAX_VEHICLES && (
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-4 text-sm font-medium text-neutral-500 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600"
            >
              <Plus className="h-4 w-4" /> Add Another Vehicle
            </button>
          )}
        </div>
      )}
    </div>
  )
}
