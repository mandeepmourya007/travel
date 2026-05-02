import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
}

export function ProgressBar({ value, max = 100, className }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-neutral-200', className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-highlight-500 transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
