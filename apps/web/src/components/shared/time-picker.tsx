'use client'

import * as React from 'react'
import { ClockIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  /** Time string like "06:00 AM" */
  value?: string
  onChange: (time: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

function parseTime(value?: string): { hour: string; minute: string; ampm: 'AM' | 'PM' } {
  if (!value) return { hour: '06', minute: '00', ampm: 'AM' }
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return { hour: '06', minute: '00', ampm: 'AM' }
  return {
    hour: match[1].padStart(2, '0'),
    minute: match[2],
    ampm: match[3].toUpperCase() as 'AM' | 'PM',
  }
}

/**
 * Time-only picker (hh:mm AM/PM) built on shadcn Popover.
 * Returns strings like "06:00 AM" — compatible with pickupPoints.time and itinerary activity time.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  disabled,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const { hour, minute, ampm } = parseTime(value)

  function emit(h: string, m: string, ap: 'AM' | 'PM') {
    onChange(`${h}:${m} ${ap}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'input flex items-center gap-2 text-left',
            !value && 'text-neutral-400',
            className
          )}
        >
          <ClockIcon className="h-4 w-4 shrink-0 text-neutral-400" />
          <span className="font-mono whitespace-nowrap">{value || placeholder}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center gap-2 p-4">
          {/* Hour */}
          <div className="flex flex-col gap-1">
            <span className="text-center text-xs font-semibold text-neutral-400">HH</span>
            <select
              value={hour}
              onChange={(e) => emit(e.target.value, minute, ampm)}
              className="input w-16 py-2 text-center font-mono text-sm"
            >
              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <span className="mt-5 text-lg font-bold text-neutral-600">:</span>

          {/* Minute */}
          <div className="flex flex-col gap-1">
            <span className="text-center text-xs font-semibold text-neutral-400">MM</span>
            <select
              value={minute}
              onChange={(e) => emit(hour, e.target.value, ampm)}
              className="input w-16 py-2 text-center font-mono text-sm"
            >
              {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* AM/PM */}
          <div className="mt-5 flex flex-col overflow-hidden rounded-lg border border-neutral-200">
            {(['AM', 'PM'] as const).map((ap) => (
              <button
                key={ap}
                type="button"
                onClick={() => emit(hour, minute, ap)}
                className={cn(
                  'px-3 py-2 text-xs font-semibold transition-colors',
                  ampm === ap
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-neutral-500 hover:bg-neutral-50'
                )}
              >
                {ap}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 transition-colors"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
