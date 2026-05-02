'use client'

import { cn } from '@/lib/utils'

interface TabItem {
  label: string
  value: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 rounded-lg bg-neutral-100 p-1 w-fit',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-md px-5 py-2 text-sm font-medium transition-all',
            item.value === value
              ? 'bg-white text-neutral-900 font-semibold shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
