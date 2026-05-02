'use client'

import { cn } from '@/lib/utils'

export const TRIP_FORM_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'dates', label: 'Dates & Pricing' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'media', label: 'Photos & Pickup' },
  { id: 'review', label: 'Review' },
] as const

export type TripFormTabId = (typeof TRIP_FORM_TABS)[number]['id']

interface TabNavigationProps {
  activeTab: TripFormTabId
  onTabChange: (tab: TripFormTabId) => void
  tabErrors?: Partial<Record<TripFormTabId, boolean>>
}

export function TabNavigation({ activeTab, onTabChange, tabErrors }: TabNavigationProps) {
  return (
    <div className="overflow-x-auto w-full border-b border-neutral-200" role="tablist">
      <div className="flex whitespace-nowrap">
        {TRIP_FORM_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-primary-600'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            {tab.label}
            {tabErrors?.[tab.id] && (
              <span className="absolute right-1 top-2 h-2 w-2 rounded-full bg-error-500" />
            )}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
