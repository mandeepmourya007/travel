'use client'

import * as React from 'react'
import { format, parse, isValid, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  /** YYYY-MM-DD string */
  value?: string
  onChange: (date: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  className?: string
}

/**
 * Single date picker built on shadcn Calendar + Popover.
 * Value and onChange use YYYY-MM-DD strings (compatible with date filter params).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  minDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const d = parse(value, 'yyyy-MM-dd', new Date())
    return isValid(d) ? d : undefined
  }, [value])

  function handleSelect(day: Date | undefined) {
    onChange(day ? format(day, 'yyyy-MM-dd') : undefined)
    setOpen(false)
  }

  const disabledDays = minDate ? (date: Date) => date < startOfDay(minDate) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'input flex items-center gap-2 text-left',
            !selected && 'text-neutral-400',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-neutral-400" />
          <span className="flex-1 truncate">
            {selected ? format(selected, 'MMM d, yyyy') : placeholder}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={disabledDays}
          autoFocus
        />
        {selected && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-right">
            <button
              type="button"
              onClick={() => { onChange(undefined); setOpen(false) }}
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
