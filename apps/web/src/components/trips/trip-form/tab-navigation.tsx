'use client'

import { useEffect, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TRIP_FORM_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'dates', label: 'Dates & Pricing' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'transfers', label: 'Pickup & Drop' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'media', label: 'Photos & Docs' },
  { id: 'review', label: 'Review' },
] as const

export type TripFormTabId = (typeof TRIP_FORM_TABS)[number]['id']

interface TabNavigationProps {
  activeTab: TripFormTabId
  onTabChange: (tab: TripFormTabId) => void
  tabErrors?: Partial<Record<TripFormTabId, boolean>>
}

export function TabNavigation({ activeTab, onTabChange, tabErrors }: TabNavigationProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeTab])

  return (
    <div className="overflow-x-auto w-full border-b border-neutral-200" role="tablist">
      <div className="flex whitespace-nowrap">
        {TRIP_FORM_TABS.map((tab) => (
          <button
            key={tab.id}
            ref={activeTab === tab.id ? activeRef : null}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              tabErrors?.[tab.id]
                ? 'text-error-500'
                : activeTab === tab.id
                  ? 'text-primary-600'
                  : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tabErrors?.[tab.id] && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
            </span>
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
