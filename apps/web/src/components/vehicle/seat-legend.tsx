'use client'

import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────

interface SeatLegendProps {
  variant?: 'picker' | 'full'
}

interface LegendItem {
  color: string
  label: string
}

const PICKER_ITEMS: LegendItem[] = [
  { color: 'bg-emerald-50 border-emerald-300', label: 'Available' },
  { color: 'bg-primary-500 border-primary-600', label: 'Selected' },
  { color: 'bg-neutral-100 border-neutral-200', label: 'Booked' },
  { color: 'bg-neutral-800 border-neutral-700', label: 'Driver' },
]

const FULL_ITEMS: LegendItem[] = [
  { color: 'bg-emerald-50 border-emerald-300', label: 'Available' },
  { color: 'bg-primary-500 border-primary-600', label: 'Selected' },
  { color: 'bg-neutral-100 border-neutral-200', label: 'Booked' },
  { color: 'bg-amber-50 border-amber-300', label: 'Held' },
  { color: 'bg-neutral-100 border-neutral-300', label: 'Blocked' },
  { color: 'bg-neutral-800 border-neutral-700', label: 'Driver' },
]

export function SeatLegend({ variant = 'picker' }: SeatLegendProps) {
  const items = variant === 'picker' ? PICKER_ITEMS : FULL_ITEMS

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-3.5 w-3.5 rounded border-2 shrink-0',
              item.color,
            )}
          />
          <span className="text-[11px] text-neutral-500 font-sans">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
