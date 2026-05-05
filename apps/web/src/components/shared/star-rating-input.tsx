'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingInputProps {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  maxStars?: number
  disabled?: boolean
  label?: string
}

const sizeMap = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
}

const ratingLabels = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent']

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
  maxStars = 5,
  disabled = false,
  label,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0)

  const displayRating = hovered || value

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium text-neutral-700">{label}</span>
      )}
      <div className="flex items-center gap-1">
        <div
          className="flex gap-0.5"
          onMouseLeave={() => !disabled && setHovered(0)}
        >
          {Array.from({ length: maxStars }, (_, i) => {
            const starValue = i + 1
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                className={cn(
                  'rounded-sm transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  !disabled && 'cursor-pointer hover:scale-110 active:scale-95',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
                onMouseEnter={() => !disabled && setHovered(starValue)}
                onClick={() => !disabled && onChange(starValue)}
                aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
              >
                <Star
                  className={cn(
                    sizeMap[size],
                    'transition-colors',
                    starValue <= displayRating
                      ? 'fill-warning-500 text-warning-500'
                      : 'fill-neutral-200 text-neutral-200',
                  )}
                />
              </button>
            )
          })}
        </div>
        {displayRating > 0 && (
          <span className="ml-2 text-sm font-medium text-neutral-600">
            {ratingLabels[displayRating]}
          </span>
        )}
      </div>
    </div>
  )
}
