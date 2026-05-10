'use client'

import { cn } from '@/lib/utils'
import type { SeatStatusConst } from '@shared/constants/vehicle'
import type { SeatCellTypeConst } from '@shared/constants/vehicle'

// ─── Props ──────────────────────────────────────────

interface SeatCellProps {
  cellType: SeatCellTypeConst
  status?: SeatStatusConst
  seatLabel?: string
  seatNumber?: number | null
  isSelected?: boolean
  selectionIndex?: number
  disabled?: boolean
  size?: 'sm' | 'md'
  onClick?: () => void
}

// ─── Status-to-style mapping (matches preview.html) ─

const STATUS_STYLES: Record<SeatStatusConst, string> = {
  AVAILABLE: 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 hover:scale-105 cursor-pointer',
  HELD: 'bg-amber-50 border-amber-300 text-amber-600 cursor-not-allowed opacity-60',
  BOOKED: 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed',
  BLOCKED: 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed',
}

const SELECTED_STYLE = 'bg-primary-500 border-primary-600 text-white cursor-pointer'

// ─── Component ──────────────────────────────────────

export function SeatCell({
  cellType,
  status = 'AVAILABLE',
  seatLabel,
  seatNumber,
  isSelected = false,
  selectionIndex,
  disabled = false,
  size = 'md',
  onClick,
}: SeatCellProps) {
  const cellSize = size === 'sm' ? 'h-9 w-9 text-[10px]' : 'h-11 w-11 text-xs'

  if (cellType === 'EMPTY') {
    return (
      <div
        className={cn(
          'shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 text-neutral-300',
          cellSize,
        )}
        aria-hidden
      >
        <span className="text-lg leading-none">✕</span>
      </div>
    )
  }

  if (cellType === 'DRIVER') {
    return (
      <div
        className={cn(
          'shrink-0 flex items-center justify-center rounded-lg border-2 border-neutral-700 bg-neutral-800 text-white cursor-not-allowed',
          cellSize,
        )}
        aria-label="Driver seat"
      >
        <span className="text-base leading-none">🛞</span>
      </div>
    )
  }

  if (cellType === 'BLOCKED') {
    return (
      <div
        className={cn(
          'shrink-0 flex items-center justify-center rounded-lg border-2 border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed',
          cellSize,
        )}
        aria-label="Blocked"
      >
        <span className="text-sm leading-none">🔒</span>
      </div>
    )
  }

  // SEAT cell
  const isClickable = status === 'AVAILABLE' && !disabled && !!onClick
  const isBooked = status === 'BOOKED' || status === 'HELD'
  const displayText = isSelected && selectionIndex != null
    ? `T${selectionIndex + 1}`
    : seatNumber ?? seatLabel

  return (
    <button
      type="button"
      onClick={isClickable || isSelected ? onClick : undefined}
      disabled={!isClickable && !isSelected}
      aria-label={`Seat ${seatLabel ?? ''} - ${status.toLowerCase()}`}
      aria-pressed={isSelected}
      title={
        isSelected && selectionIndex != null
          ? `Traveler ${selectionIndex + 1} — Seat ${seatNumber ?? seatLabel} (click to deselect)`
          : isBooked ? `Seat ${seatNumber ?? seatLabel} — ${status.toLowerCase()}`
          : `Seat ${seatNumber ?? seatLabel} — click to select`
      }
      className={cn(
        'shrink-0 flex items-center justify-center rounded-lg border-2 font-mono font-semibold transition-all duration-150 select-none',
        cellSize,
        isSelected ? SELECTED_STYLE : STATUS_STYLES[status],
        disabled && !isSelected && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span>{displayText}</span>
    </button>
  )
}
