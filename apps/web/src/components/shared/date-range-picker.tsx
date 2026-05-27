'use client'

import * as React from 'react'
import { format, parse, isValid, startOfDay } from 'date-fns'
import { CalendarIcon, ArrowRightIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  /** YYYY-MM-DD */
  from?: string
  /** YYYY-MM-DD */
  to?: string
  onFromChange: (date: string | undefined) => void
  onToChange: (date: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  className?: string
}

function parseYMD(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

/**
 * Date range picker using a single Calendar in range mode.
 * from/to values are YYYY-MM-DD strings (compatible with payment filter params).
 * Caller is responsible for ensuring from <= to when pre-populating.
 */
export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  placeholder = 'Pick date range',
  disabled,
  minDate,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse once — reuse for both the Calendar `selected` prop and the trigger display.
  const range: DateRange = React.useMemo(() => ({
    from: parseYMD(from),
    to: parseYMD(to),
  }), [from, to])

  const fromDate = range.from
  const toDate = range.to

  function handleSelect(value: DateRange | undefined) {
    onFromChange(value?.from ? format(value.from, 'yyyy-MM-dd') : undefined)
    onToChange(value?.to ? format(value.to, 'yyyy-MM-dd') : undefined)
    if (value?.from && value?.to) setOpen(false)
  }

  const disabledDays = minDate ? (date: Date) => date < startOfDay(minDate) : undefined

  const hasSelection = Boolean(fromDate)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'input flex items-center gap-2 text-left',
            !hasSelection && 'text-neutral-400',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-neutral-400" />
          {hasSelection ? (
            <span className="flex flex-1 items-center gap-1 truncate text-sm">
              <span>{format(fromDate!, 'MMM d, yyyy')}</span>
              <ArrowRightIcon className="h-3 w-3 shrink-0 text-neutral-400" />
              {toDate ? (
                <span>{format(toDate, 'MMM d, yyyy')}</span>
              ) : (
                <span className="text-neutral-400">End date</span>
              )}
            </span>
          ) : (
            <span className="flex-1 truncate">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          disabled={disabledDays}
          numberOfMonths={1}
          autoFocus
        />
        {(from || to) && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-right">
            <button
              type="button"
              onClick={() => {
                onFromChange(undefined)
                onToChange(undefined)
              }}
              className="text-xs font-medium text-neutral-500 hover:text-error-500 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
