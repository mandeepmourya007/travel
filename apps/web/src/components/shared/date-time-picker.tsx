'use client'

import * as React from 'react'
import { format, parseISO, isValid, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'

interface DateTimePickerProps {
  value?: string
  onChange: (iso: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  className?: string
}

/**
 * Date + time picker built on shadcn Calendar + Popover (desktop) / Sheet (mobile).
 * Value and onChange use ISO 8601 UTC strings (compatible with CreateTripDto).
 *
 * Contract: emits an absolute UTC instant via toISOString(). The hours set
 * represent the user's local time — e.g. selecting "06:00 AM" in IST stores
 * the equivalent UTC value. Callers and the API must treat this as a UTC
 * absolute instant and convert to local time for display.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick date & time',
  disabled,
  minDate,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const d = parseISO(value)
    return isValid(d) ? d : undefined
  }, [value])

  const hour = selectedDate ? format(selectedDate, 'hh') : '06'
  const minute = selectedDate ? format(selectedDate, 'mm') : '00'
  const ampm: 'AM' | 'PM' = selectedDate ? (selectedDate.getHours() >= 12 ? 'PM' : 'AM') : 'AM'

  const [calDate, setCalDate] = React.useState<Date | undefined>(selectedDate)

  React.useEffect(() => {
    if (!value) { setCalDate(undefined); return }
    const d = parseISO(value)
    if (isValid(d)) setCalDate(d)
  }, [value])

  function buildISO(date: Date, h: string, m: string, ap: 'AM' | 'PM'): string {
    const result = new Date(date)
    let hours = parseInt(h, 10) % 12
    if (ap === 'PM') hours += 12
    result.setHours(hours, parseInt(m, 10), 0, 0)
    return result.toISOString()
  }

  function handleDaySelect(day: Date | undefined) {
    setCalDate(day)
    if (!day) { onChange(undefined); return }
    onChange(buildISO(day, hour, minute, ampm))
  }

  function handleTimeChange(h: string, m: string, ap: 'AM' | 'PM') {
    if (!calDate) return
    onChange(buildISO(calDate, h, m, ap))
  }

  const displayText = selectedDate
    ? format(selectedDate, 'MMM d, yyyy · hh:mm aaa')
    : undefined

  const disabledDays = minDate ? (date: Date) => date < startOfDay(minDate) : undefined

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'input flex items-center gap-2 text-left',
        !displayText && 'text-neutral-400',
        className
      )}
    >
      <CalendarIcon className="h-4 w-4 shrink-0 text-neutral-400" />
      <span className="flex-1 truncate">{displayText ?? placeholder}</span>
    </button>
  )

  const pickerContent = (
    <>
      <Calendar
        mode="single"
        selected={calDate}
        onSelect={handleDaySelect}
        disabled={disabledDays}
        className={cn(
          'w-full',
          isMobile && '[--cell-size:2.75rem]'
        )}
        autoFocus
      />

      {/* Time row — stacked so controls never overlap on narrow screens */}
      <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500 shrink-0 w-8">Time</span>

          <select
            value={hour}
            onChange={(e) => handleTimeChange(e.target.value, minute, ampm)}
            className={cn('input font-mono text-center', isMobile ? 'flex-1 py-2.5 text-base' : 'w-14 py-1.5 text-sm')}
          >
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          <span className="text-base font-bold text-neutral-600">:</span>

          <select
            value={minute}
            onChange={(e) => handleTimeChange(hour, e.target.value, ampm)}
            className={cn('input font-mono text-center', isMobile ? 'flex-1 py-2.5 text-base' : 'w-14 py-1.5 text-sm')}
          >
            {['00', '15', '30', '45'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-lg border border-neutral-200 shrink-0">
            {(['AM', 'PM'] as const).map((ap) => (
              <button
                key={ap}
                type="button"
                onClick={() => handleTimeChange(hour, minute, ap)}
                className={cn(
                  'font-semibold transition-colors',
                  isMobile ? 'px-4 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs',
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

        <div className="flex items-center justify-end gap-3">
          {selectedDate && (
            <button
              type="button"
              onClick={() => { onChange(undefined); setOpen(false) }}
              className={cn(
                'font-medium text-neutral-500 hover:text-error-500 transition-colors',
                isMobile ? 'text-sm' : 'text-xs'
              )}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-lg bg-primary-500 font-semibold text-white hover:bg-primary-600 transition-colors',
              isMobile ? 'px-6 py-2.5 text-sm' : 'px-3 py-1.5 text-xs'
            )}
          >
            Done
          </button>
        </div>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[90svh] overflow-y-auto">
          <SheetHeader className="px-4 pt-5 pb-1">
            <SheetTitle className="text-base">{placeholder}</SheetTitle>
          </SheetHeader>
          {pickerContent}
          {/* Bottom spacing for iOS home bar */}
          <div className="h-6" />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[280px] p-0"
        align="start"
        collisionPadding={8}
      >
        {pickerContent}
      </PopoverContent>
    </Popover>
  )
}
