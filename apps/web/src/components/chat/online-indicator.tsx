'use client'

import { cn } from '@/lib/utils'

interface OnlineIndicatorProps {
  isOnline: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function OnlineIndicator({ isOnline, size = 'sm', className }: OnlineIndicatorProps) {
  return (
    <span
      className={cn(
        'rounded-full border-2 border-white',
        size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
        isOnline ? 'bg-success-500' : 'bg-neutral-300',
        className,
      )}
    />
  )
}
