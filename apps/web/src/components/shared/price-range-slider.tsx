'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'

const PRICE_STEP_DEFAULT = 100

interface PriceRangeSliderProps {
  min: number
  max: number
  /** Step size. Defaults to 500. */
  step?: number
  /** Controlled value as [low, high]. */
  value: [number, number]
  /** Fires on every thumb move (live, while dragging). */
  onValueChange: (value: [number, number]) => void
  /** Fires once when the pointer is released (commit). */
  onValueCommit?: (value: [number, number]) => void
  /** How to format the value shown in bubbles. Defaults to formatCurrency (₹). */
  formatValue?: (n: number) => string
  className?: string
}

/**
 * Dual-handle price range slider.
 * Renders a gradient track with two draggable thumbs and floating value bubbles.
 * Designed to be composed alongside NumberInput fields for two-way sync.
 */
export function PriceRangeSlider({
  min,
  max,
  step = PRICE_STEP_DEFAULT,
  value,
  onValueChange,
  onValueCommit,
  formatValue = formatCurrency,
  className,
}: PriceRangeSliderProps) {
  const [lo, hi] = value
  const range = max - min || 1

  const loPercent = ((lo - min) / range) * 100
  const hiPercent = ((hi - min) / range) * 100

  const handleValueChange = (raw: number[]) => {
    if (raw.length === 2) onValueChange([raw[0], raw[1]])
  }

  const handleValueCommit = (raw: number[]) => {
    if (raw.length === 2) onValueCommit?.([raw[0], raw[1]])
  }

  return (
    <div className={cn('relative pt-8 pb-1', className)}>
      {/* Value bubbles */}
      <div
        className="pointer-events-none absolute top-0 left-0 w-full"
        aria-hidden
      >
        {/* Min bubble */}
        <BubbleLabel
          percent={loPercent}
          label={formatValue(lo)}
          side="min"
        />
        {/* Max bubble */}
        <BubbleLabel
          percent={hiPercent}
          label={formatValue(hi)}
          side="max"
        />
      </div>

      {/* Radix slider */}
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={[lo, hi]}
        minStepsBetweenThumbs={1}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        className="relative flex w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary-100">
          <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary-500 to-accent-500" />
        </SliderPrimitive.Track>

        {/* Low thumb */}
        <SliderPrimitive.Thumb
          aria-label="Minimum price"
          className="block h-4 w-4 rounded-full border border-primary-500/50 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:pointer-events-none disabled:opacity-50"
        />
        {/* High thumb */}
        <SliderPrimitive.Thumb
          aria-label="Maximum price"
          className="block h-4 w-4 rounded-full border border-accent-500/50 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-100 disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal helper: floating value bubble above a thumb
// ---------------------------------------------------------------------------
interface BubbleLabelProps {
  percent: number
  label: string
  /** Used to clamp near-edge bubbles so they don't overflow the container. */
  side: 'min' | 'max'
}

function BubbleLabel({ percent, label, side }: BubbleLabelProps) {
  // Clamp translateX so the bubble never overflows the track on small screens.
  // At 0% we nudge it right; at 100% we nudge it left.
  const clampedPercent = Math.min(Math.max(percent, 0), 100)
  const nudge =
    clampedPercent < 5
      ? '0%'
      : clampedPercent > 95
        ? '-100%'
        : '-50%'

  return (
    <span
      className="absolute inline-flex flex-col items-center"
      style={{ left: `${clampedPercent}%`, transform: `translateX(${nudge})` }}
    >
      <span
        className={cn(
          'whitespace-nowrap rounded-lg border bg-white px-1.5 py-0.5 text-xs font-semibold text-neutral-700 shadow-sm',
          side === 'min' ? 'border-primary-300' : 'border-accent-300',
        )}
      >
        {label}
      </span>
      {/* Small caret */}
      <span
        className={cn(
          'h-1.5 w-0.5',
          side === 'min' ? 'bg-primary-300' : 'bg-accent-300',
        )}
      />
    </span>
  )
}
