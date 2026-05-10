'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { SeatCellTypeConst, VehicleTypeConst } from '@shared/constants/vehicle'
import type { CreateVehicleDto, LayoutConfig } from '@shared/types/vehicle.types'

// ─── Props ──────────────────────────────────────────

interface SeatLayoutBuilderProps {
  initialLayout?: SeatCellTypeConst[][]
  initialConfig?: LayoutConfig
  initialVehicleType?: VehicleTypeConst
  initialLabel?: string
  onSave: (dto: CreateVehicleDto) => void
  isSaving?: boolean
}

// ─── Template Types ─────────────────────────────────

type BuilderTemplateKey = 'sedan' | 'ertiga' | 'innova' | 'tempo' | 'minibus' | 'bus22' | 'bus23' | 'custom'

interface BuilderTemplate {
  name: string
  icon: string
  btnLabel: string
  vehicleType: VehicleTypeConst
  rows: number
  cols: number
  aisleAfterCol: number | null
  driverPos: [number, number]
}

const TEMPLATES: Record<BuilderTemplateKey, BuilderTemplate> = {
  sedan:   { name: 'Sedan',           icon: '🚗', btnLabel: 'Sedan (4+D)',       vehicleType: 'sedan',   rows: 2,  cols: 3, aisleAfterCol: null, driverPos: [0, 2] },
  ertiga:  { name: 'Ertiga',          icon: '🚗', btnLabel: 'Ertiga (7+D)',      vehicleType: 'ertiga',  rows: 3,  cols: 3, aisleAfterCol: null, driverPos: [0, 2] },
  innova:  { name: 'Innova',          icon: '🚗', btnLabel: 'Innova (6+D)',      vehicleType: 'innova',  rows: 3,  cols: 3, aisleAfterCol: null, driverPos: [0, 2] },
  tempo:   { name: 'Tempo Traveller', icon: '🚐', btnLabel: 'Tempo (12+D)',      vehicleType: 'tempo',   rows: 5,  cols: 3, aisleAfterCol: 1,    driverPos: [0, 2] },
  minibus: { name: 'Mini Bus',        icon: '🚌', btnLabel: 'Mini Bus (20+D)',   vehicleType: 'minibus', rows: 6,  cols: 4, aisleAfterCol: 1,    driverPos: [0, 3] },
  bus22:   { name: 'Bus (2+2)',       icon: '🚌', btnLabel: 'Bus 2+2 (40+D)',    vehicleType: 'bus',     rows: 11, cols: 4, aisleAfterCol: 1,    driverPos: [0, 3] },
  bus23:   { name: 'Bus (2+3)',       icon: '🚌', btnLabel: 'Bus 2+3 (49+D)',    vehicleType: 'bus',     rows: 11, cols: 5, aisleAfterCol: 1,    driverPos: [0, 4] },
  custom:  { name: 'Custom',          icon: '🔧', btnLabel: 'Custom',            vehicleType: 'custom',  rows: 3,  cols: 4, aisleAfterCol: 1,    driverPos: [0, 3] },
}

const TEMPLATE_KEYS: BuilderTemplateKey[] = ['sedan', 'ertiga', 'innova', 'tempo', 'minibus', 'bus22', 'bus23', 'custom']

const TEMPLATE_OVERRIDES: Record<BuilderTemplateKey, Record<string, SeatCellTypeConst>> = {
  sedan:   { '0,1': 'EMPTY' },
  ertiga:  { '0,1': 'EMPTY' },
  innova:  { '0,1': 'EMPTY', '2,2': 'EMPTY' },
  tempo:   { '0,1': 'EMPTY' },
  minibus: { '0,1': 'EMPTY', '0,2': 'EMPTY' },
  bus22:   { '0,1': 'EMPTY', '0,2': 'EMPTY' },
  bus23:   { '0,1': 'EMPTY', '0,2': 'EMPTY', '0,3': 'EMPTY' },
  custom:  { '0,1': 'EMPTY', '0,2': 'EMPTY' },
}

// ─── Dropdown Options ───────────────────────────────

const DROPDOWN_OPTIONS: { type: SeatCellTypeConst; label: string; icon: string; bg: string; border: string; dashed: boolean }[] = [
  { type: 'SEAT',    label: 'Seat',    icon: '💺', bg: 'bg-primary-50',  border: 'border-primary-300', dashed: false },
  { type: 'EMPTY',   label: 'No Seat', icon: '✕',  bg: 'bg-neutral-50',  border: 'border-neutral-200', dashed: true },
  { type: 'BLOCKED', label: 'Blocked', icon: '🔒', bg: 'bg-neutral-100', border: 'border-neutral-300', dashed: false },
]

// ─── Helpers ────────────────────────────────────────

const CELL_SIZE = 44
const AISLE_SIZE = 24

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function buildTemplateLayout(key: BuilderTemplateKey): SeatCellTypeConst[][] {
  const t = TEMPLATES[key]
  const overrides = TEMPLATE_OVERRIDES[key]
  const layout: SeatCellTypeConst[][] = []
  for (let r = 0; r < t.rows; r++) {
    const row: SeatCellTypeConst[] = []
    for (let c = 0; c < t.cols; c++) {
      const coordKey = `${r},${c}`
      if (r === t.driverPos[0] && c === t.driverPos[1]) {
        row.push('DRIVER')
      } else if (overrides[coordKey]) {
        row.push(overrides[coordKey])
      } else {
        row.push('SEAT')
      }
    }
    layout.push(row)
  }
  return layout
}

function computeSeatNumbers(layout: SeatCellTypeConst[][]): (number | null)[][] {
  let num = 1
  return layout.map((row) =>
    row.map((cell) => (cell === 'SEAT' ? num++ : null)),
  )
}

function countCells(layout: SeatCellTypeConst[][]) {
  let seats = 0, drivers = 0, blocked = 0
  for (const row of layout) {
    for (const cell of row) {
      if (cell === 'SEAT') seats++
      else if (cell === 'DRIVER') drivers++
      else if (cell === 'BLOCKED') blocked++
    }
  }
  return { seats, drivers, blocked }
}

function buildColTemplate(cols: number, aisleAfterCol: number | null): string {
  const parts: string[] = []
  for (let c = 0; c < cols; c++) {
    parts.push(`${CELL_SIZE}px`)
    if (aisleAfterCol !== null && c === aisleAfterCol) {
      parts.push(`${AISLE_SIZE}px`)
    }
  }
  return parts.join(' ')
}

function resolveTemplateKey(vehicleType?: VehicleTypeConst): BuilderTemplateKey {
  if (!vehicleType) return 'innova'
  if (vehicleType === 'bus') return 'bus22'
  if (TEMPLATE_KEYS.includes(vehicleType as BuilderTemplateKey)) return vehicleType as BuilderTemplateKey
  return 'innova'
}

// ─── Cell Styles (builder-specific) ─────────────────

const CELL_CLASSES: Record<SeatCellTypeConst, string> = {
  SEAT: 'bg-primary-50 border-2 border-solid border-primary-300 text-primary-700 cursor-pointer hover:bg-primary-100 hover:border-primary-400',
  DRIVER: 'bg-neutral-800 border-2 border-solid border-neutral-700 text-white cursor-not-allowed',
  EMPTY: 'bg-neutral-50 border-2 border-dashed border-neutral-200 text-neutral-300 cursor-pointer hover:border-neutral-300 hover:bg-neutral-100',
  BLOCKED: 'bg-neutral-100 border-2 border-solid border-neutral-300 text-neutral-400 cursor-pointer hover:bg-neutral-200',
}

const CELL_DISPLAY: Record<SeatCellTypeConst, string | null> = {
  SEAT: null,
  DRIVER: '🛞',
  EMPTY: '✕',
  BLOCKED: '🔒',
}

// ─── Component ──────────────────────────────────────

export function SeatLayoutBuilder({
  initialLayout,
  initialConfig,
  initialVehicleType,
  initialLabel,
  onSave,
  isSaving = false,
}: SeatLayoutBuilderProps) {
  const [templateKey, setTemplateKey] = useState<BuilderTemplateKey>(resolveTemplateKey(initialVehicleType))
  const [label, setLabel] = useState(initialLabel ?? '')
  const [gridRows, setGridRows] = useState(initialConfig?.rows ?? TEMPLATES.innova.rows)
  const [gridCols, setGridCols] = useState(initialConfig?.cols ?? TEMPLATES.innova.cols)
  const [aisleAfterCol, setAisleAfterCol] = useState<number | null>(initialConfig?.aisleAfterCol ?? null)
  const [layout, setLayout] = useState<SeatCellTypeConst[][]>(
    initialLayout ?? buildTemplateLayout('innova'),
  )
  const [dropdown, setDropdown] = useState<{ row: number; col: number; x: number; y: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Derived state
  const driverPos: [number, number] = useMemo(() => [0, gridCols - 1], [gridCols])
  const seatNumbers = useMemo(() => computeSeatNumbers(layout), [layout])
  const counts = useMemo(() => countCells(layout), [layout])
  const leftCols = aisleAfterCol !== null ? aisleAfterCol + 1 : gridCols
  const rightCols = aisleAfterCol !== null ? gridCols - aisleAfterCol - 1 : 0
  const tpl = TEMPLATES[templateKey]

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdown])

  // ── Actions ──────────────────────────────

  const enforceDriver = useCallback((lyt: SeatCellTypeConst[][], cols: number): SeatCellTypeConst[][] => {
    const next = lyt.map((r) => [...r])
    for (let r = 0; r < next.length; r++) {
      for (let c = 0; c < next[r].length; c++) {
        if (next[r][c] === 'DRIVER') next[r][c] = 'EMPTY'
      }
    }
    if (next[0] && next[0][cols - 1] !== undefined) {
      next[0][cols - 1] = 'DRIVER'
    }
    return next
  }, [])

  const applyTemplate = useCallback((key: BuilderTemplateKey) => {
    const t = TEMPLATES[key]
    setTemplateKey(key)
    setGridRows(t.rows)
    setGridCols(t.cols)
    setAisleAfterCol(t.aisleAfterCol)
    setLayout(buildTemplateLayout(key))
    setLabel(t.name)
    setDropdown(null)
  }, [])

  const rebuildLayout = useCallback((newRows: number, newCols: number) => {
    setLayout((prev) => {
      const next: SeatCellTypeConst[][] = []
      for (let r = 0; r < newRows; r++) {
        const row: SeatCellTypeConst[] = []
        for (let c = 0; c < newCols; c++) {
          row.push(prev[r]?.[c] ?? 'SEAT')
        }
        next.push(row)
      }
      return enforceDriver(next, newCols)
    })
  }, [enforceDriver])

  const adjustGrid = useCallback((field: string, delta: number) => {
    let lc = leftCols, rc = rightCols, r = gridRows, ac = aisleAfterCol, c = gridCols
    switch (field) {
      case 'rows':
        r = clamp(r + delta, 2, 15)
        break
      case 'leftCols':
        lc = clamp(lc + delta, 1, 4)
        c = lc + rc
        if (ac !== null) ac = lc - 1
        break
      case 'rightCols':
        rc = clamp(rc + delta, 0, 4)
        if (rc === 0) { c = lc; ac = null }
        else { c = lc + rc; if (ac === null) ac = lc - 1 }
        break
      case 'aisle':
        if (ac === null) { if (c >= 2) ac = 0 }
        else { const next = ac + delta; if (next < 0) ac = null; else if (next < c - 1) ac = next }
        break
    }
    setGridRows(r)
    setGridCols(c)
    setAisleAfterCol(ac)
    rebuildLayout(r, c)
    setDropdown(null)
  }, [leftCols, rightCols, gridRows, aisleAfterCol, gridCols, rebuildLayout])

  const handleCellClick = useCallback((r: number, c: number, e: React.MouseEvent) => {
    if (layout[r][c] === 'DRIVER') return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = clamp(rect.left + rect.width / 2 - 75, 8, window.innerWidth - 158)
    const y = rect.bottom + 6 + 160 > window.innerHeight ? rect.top - 160 - 6 : rect.bottom + 6
    setDropdown({ row: r, col: c, x, y })
  }, [layout])

  const handleDropdownSelect = useCallback((type: SeatCellTypeConst) => {
    if (!dropdown) return
    setLayout((prev) => {
      const next = prev.map((row) => [...row])
      next[dropdown.row][dropdown.col] = type
      return next
    })
    setDropdown(null)
  }, [dropdown])

  const handleSave = () => {
    const config: LayoutConfig = {
      rows: gridRows,
      cols: gridCols,
      aisleAfterCol,
      driverPos,
    }
    onSave({
      label: label || undefined,
      vehicleType: tpl.vehicleType,
      layoutConfig: config,
      layout,
    })
  }

  // ── Render ───────────────────────────────

  return (
    <div className="space-y-5">
      {/* Template Buttons */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Predefined Templates
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyTemplate(key)}
              className={cn(
                'rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-all',
                templateKey === key
                  ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-400 hover:text-primary-600',
              )}
            >
              {TEMPLATES[key].btnLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Name */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-neutral-700" htmlFor="vehicle-label">
          Vehicle Name
        </label>
        <input
          id="vehicle-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Innova Crysta #1"
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 outline-none transition-all placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Grid Controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <ControlGroup label="Rows" value={String(gridRows)} onMinus={() => adjustGrid('rows', -1)} onPlus={() => adjustGrid('rows', 1)} />
        <ControlGroup label="Left Cols" value={String(leftCols)} onMinus={() => adjustGrid('leftCols', -1)} onPlus={() => adjustGrid('leftCols', 1)} />
        <ControlGroup label="Right Cols" value={String(rightCols)} onMinus={() => adjustGrid('rightCols', -1)} onPlus={() => adjustGrid('rightCols', 1)} />
        <ControlGroup
          label="Aisle After"
          value={aisleAfterCol !== null ? `Col ${aisleAfterCol + 1}` : 'None'}
          onMinus={() => adjustGrid('aisle', -1)}
          onPlus={() => adjustGrid('aisle', 1)}
        />
      </div>

      {/* Vehicle Header */}
      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
        <span className="text-xl">{tpl.icon}</span>
        <span className="text-base font-bold text-neutral-800">{tpl.name}</span>
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
          {counts.seats} seats
        </span>
      </div>

      {/* Seat Grid */}
      <div className="overflow-x-auto px-1">
        <div
          className="inline-grid gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
          style={{ gridTemplateColumns: buildColTemplate(gridCols, aisleAfterCol) }}
        >
          {layout.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const seatNum = seatNumbers[rIdx][cIdx]
              const isDriver = cell === 'DRIVER'
              const displayText = cell === 'SEAT' ? (seatNum ?? '') : (CELL_DISPLAY[cell] ?? '')
              return (
                <BuilderCellFragment key={`${rIdx}-${cIdx}`}>
                  <div
                    role="button"
                    tabIndex={isDriver ? -1 : 0}
                    title={isDriver ? `${rIdx + 1}${String.fromCharCode(65 + cIdx)} — Driver (locked)` : `${rIdx + 1}${String.fromCharCode(65 + cIdx)} — ${cell} (click to change)`}
                    onClick={isDriver ? undefined : (e) => handleCellClick(rIdx, cIdx, e)}
                    onKeyDown={isDriver ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') handleCellClick(rIdx, cIdx, e as unknown as React.MouseEvent) }}
                    className={cn(
                      'flex h-[44px] w-[44px] items-center justify-center rounded-lg text-xs font-semibold font-mono select-none transition-all',
                      CELL_CLASSES[cell],
                    )}
                  >
                    {displayText}
                  </div>
                  {aisleAfterCol !== null && cIdx === aisleAfterCol && (
                    <AisleGap />
                  )}
                </BuilderCellFragment>
              )
            }),
          )}
        </div>
      </div>

      {/* Builder Legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <LegendItem bg="bg-primary-50 border-2 border-solid border-primary-300" label="Seat (click to change)" />
        <LegendItem bg="bg-neutral-800 border-2 border-solid border-neutral-700" label="Driver" />
        <LegendItem bg="bg-neutral-50 border-2 border-dashed border-neutral-200" icon="✕" label="No Seat (door/gap)" />
        <LegendItem bg="bg-neutral-100 border-2 border-solid border-neutral-300" label="Blocked" />
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-[13px] text-neutral-600">
        <span><strong className="font-bold text-neutral-800">{counts.seats}</strong> bookable seats</span>
        <span><strong className="font-bold text-neutral-800">{counts.drivers}</strong> driver</span>
        <span><strong className="font-bold text-neutral-800">{counts.blocked}</strong> blocked</span>
        <span className="text-neutral-400">
          Grid: {gridRows} × {gridCols}
          {aisleAfterCol !== null && ` (aisle after col ${aisleAfterCol + 1})`}
        </span>
      </div>

      {/* Save */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <button
          type="button"
          onClick={handleSave}
          disabled={counts.seats === 0 || isSaving}
          className={cn(
            'rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all',
            'bg-primary-500 hover:bg-primary-600 hover:shadow-lg disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none disabled:cursor-not-allowed',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Layout'}
        </button>
      </div>

      {/* Dropdown Menu (portal-like fixed positioning) */}
      {dropdown && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setDropdown(null)} />
          <div
            ref={dropdownRef}
            className="fixed z-[200] min-w-[150px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
            style={{ left: dropdown.x, top: dropdown.y }}
          >
            {DROPDOWN_OPTIONS.map((opt) => {
              const isActive = layout[dropdown.row]?.[dropdown.col] === opt.type
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleDropdownSelect(opt.type)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors',
                    isActive ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-neutral-600 hover:bg-neutral-50',
                  )}
                >
                  <span
                    className={cn(
                      'h-4 w-4 shrink-0 rounded',
                      opt.bg,
                      opt.dashed ? 'border-2 border-dashed' : 'border-2 border-solid',
                      opt.border,
                    )}
                  />
                  <span>{opt.icon}  {opt.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────

function ControlGroup({ label, value, onMinus, onPlus }: {
  label: string
  value: string
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[70px] text-[13px] font-semibold text-neutral-600">{label}</span>
      <button
        type="button"
        onClick={onMinus}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-bold text-neutral-600 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
      >
        −
      </button>
      <span className="min-w-[32px] text-center text-sm font-bold font-mono text-neutral-800">{value}</span>
      <button
        type="button"
        onClick={onPlus}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-bold text-neutral-600 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
      >
        +
      </button>
    </div>
  )
}

function BuilderCellFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function AisleGap() {
  return (
    <div className="relative flex h-[44px] w-[24px] items-center justify-center" aria-hidden>
      <div className="absolute inset-y-0 left-[5px] w-px bg-[repeating-linear-gradient(to_bottom,transparent,transparent_4px,var(--neutral-200)_4px,var(--neutral-200)_12px)]" />
      <div className="absolute inset-y-0 right-[5px] w-px bg-[repeating-linear-gradient(to_bottom,transparent,transparent_4px,var(--neutral-200)_4px,var(--neutral-200)_12px)]" />
    </div>
  )
}

function LegendItem({ bg, label, icon }: { bg: string; label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-neutral-600">
      <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px]', bg)}>
        {icon && <span className="text-neutral-300">{icon}</span>}
      </div>
      {label}
    </div>
  )
}
