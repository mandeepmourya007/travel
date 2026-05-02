import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <div role="status" aria-label={label || 'Loading'} className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('spinner', `spinner-${size}`)} />
      {label && <p className="text-sm text-neutral-500">{label}</p>}
    </div>
  )
}
