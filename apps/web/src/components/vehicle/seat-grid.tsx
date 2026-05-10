'use client'

import { cn } from '@/lib/utils'
import { SeatCell } from './seat-cell'
import type { SeatCellTypeConst, SeatStatusConst } from '@shared/constants/vehicle'
import type { VehicleSeatItem } from '@shared/types/vehicle.types'

// ─── Props ──────────────────────────────────────────

interface SeatGridProps {
  layout: SeatCellTypeConst[][]
  seats: VehicleSeatItem[]
  aisleAfterCol: number | null
  selectedSeatIds?: Set<string>
  selectionOrder?: string[]
  size?: 'sm' | 'md'
  onSeatClick?: (seat: VehicleSeatItem) => void
}

// ─── Component ──────────────────────────────────────

export function SeatGrid({
  layout,
  seats,
  aisleAfterCol,
  selectedSeatIds,
  selectionOrder,
  size = 'md',
  onSeatClick,
}: SeatGridProps) {
  const seatMap = new Map<string, VehicleSeatItem>()
  for (const seat of seats) {
    seatMap.set(`${seat.row}-${seat.col}`, seat)
  }

  const cellGap = size === 'sm' ? 'gap-1.5' : 'gap-1.5'

  return (
    <div className="overflow-x-auto p-1">
      <div
        className="inline-flex flex-col items-center rounded-xl border border-neutral-200 bg-neutral-50 p-4"
        role="grid"
        aria-label="Seat layout"
      >
        {layout.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={cn('flex items-center', cellGap)}
            role="row"
          >
            {/* Row label */}
            <div className="w-5 flex-shrink-0 text-center font-mono text-[11px] font-semibold text-neutral-400">
              {rowIdx + 1}
            </div>

            {row.map((cellType, colIdx) => {
              const seat = seatMap.get(`${rowIdx}-${colIdx}`)
              const status: SeatStatusConst = seat?.status ?? 'AVAILABLE'
              const isSelected = seat ? (selectedSeatIds?.has(seat.id) ?? false) : false
              const selectionIdx = isSelected && selectionOrder && seat
                ? selectionOrder.indexOf(seat.id)
                : undefined

              return (
                <div key={colIdx} className="flex items-center" role="gridcell">
                  <SeatCell
                    cellType={cellType}
                    status={cellType === 'SEAT' ? status : undefined}
                    seatLabel={seat?.seatLabel}
                    seatNumber={seat?.seatNumber}
                    isSelected={isSelected}
                    selectionIndex={selectionIdx !== undefined && selectionIdx >= 0 ? selectionIdx : undefined}
                    disabled={!onSeatClick}
                    size={size}
                    onClick={
                      cellType === 'SEAT' && seat && onSeatClick
                        ? () => onSeatClick(seat)
                        : undefined
                    }
                  />
                  {/* Aisle gap with dashed lines (matches preview.html .seat-aisle-gap) */}
                  {aisleAfterCol !== null && colIdx === aisleAfterCol && (
                    <div
                      className="relative flex-shrink-0 w-6"
                      style={{ minHeight: size === 'sm' ? 36 : 44 }}
                      aria-hidden
                    >
                      <div className="absolute left-[5px] top-0 bottom-0 w-0.5 bg-repeat-y" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, rgb(209 213 219) 0px, rgb(209 213 219) 6px, transparent 6px, transparent 12px)' }} />
                      <div className="absolute right-[5px] top-0 bottom-0 w-0.5 bg-repeat-y" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, rgb(209 213 219) 0px, rgb(209 213 219) 6px, transparent 6px, transparent 12px)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
