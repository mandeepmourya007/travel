import { cn } from '@/lib/utils'

interface TooltipProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-block', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        {label}
        {/* Arrow */}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-neutral-800" />
      </span>
    </span>
  )
}
