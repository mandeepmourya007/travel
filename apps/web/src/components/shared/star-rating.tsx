import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  count?: number
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 'sm',
  showValue = false,
  count,
}: StarRatingProps) {
  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: maxStars }, (_, i) => (
          <Star
            key={i}
            className={cn(
              sizeMap[size],
              i < Math.round(rating)
                ? 'fill-warning-500 text-warning-500'
                : 'fill-neutral-200 text-neutral-200',
            )}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-neutral-700">{rating.toFixed(1)}</span>
      )}
      {count !== undefined && (
        <span className="text-sm text-neutral-500">({count})</span>
      )}
    </div>
  )
}
