'use client'

import { cn } from '@/lib/utils'

interface TypingIndicatorProps {
  names?: string[]
  className?: string
}

export function TypingIndicator({ names = [], className }: TypingIndicatorProps) {
  if (names.length === 0) return null

  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.slice(0, 2).join(', ')} are typing`

  return (
    <div className={cn('flex items-center gap-2 px-4 py-1 text-xs text-neutral-500', className)}>
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
      </div>
      <span>{text}</span>
    </div>
  )
}
