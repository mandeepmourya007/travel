'use client'

import Link from 'next/link'
import Image from 'next/image'
import { X, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { CompareItem } from '@/hooks/use-compare-queue'

interface CompareBarProps {
  items: CompareItem[]
  onRemove: (id: string) => void
  onClose: () => void
  isOpen: boolean
  /** Maximum trips allowed in comparison (default: 3) */
  maxItems?: number
}

/**
 * Floating bottom bar showing selected trips for comparison.
 *
 * Displays thumbnail cards for selected items, empty "Add Trip" slots
 * for remaining capacity, and a "Compare Now" CTA when ≥2 trips are selected.
 * Renders nothing when items is empty or bar is dismissed.
 */
export function CompareBar({ items, onRemove, onClose, isOpen, maxItems = 3 }: CompareBarProps) {
  if (items.length === 0 || !isOpen) return null

  const slugParam = items.map((i) => i.slug).join(',')
  const canCompare = items.length >= 2
  const emptySlots = maxItems - items.length

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 shadow-xl animate-slide-up will-change-transform">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-neutral-100 bg-neutral-50">
        <span className="text-xs sm:text-sm text-neutral-700">
          <strong>{items.length} trip{items.length !== 1 ? 's' : ''}</strong> in your{' '}
          <span className="text-primary-600 font-semibold">compare queue</span>
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 transition-colors"
          aria-label="Close compare bar"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Product grid */}
      <div className="px-4 sm:px-6 py-3">
        <div
          className="grid gap-2 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${maxItems + 1}, minmax(0, 1fr))` }}
        >
          {/* Selected items */}
          {items.map((item) => (
            <div key={item.id} className="relative flex flex-col items-center text-center">
              <button
                onClick={() => onRemove(item.id)}
                className="absolute -top-1 -right-1 z-10 rounded-full bg-neutral-200 p-0.5 text-neutral-500 hover:bg-neutral-300 transition-colors"
                aria-label={`Remove ${item.title} from comparison`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="relative w-full aspect-square max-w-20 sm:max-w-24 rounded-lg overflow-hidden bg-neutral-100 mx-auto">
                {item.photo ? (
                  <Image src={item.photo} alt={item.title} fill sizes="96px" className="object-cover" />
                ) : (
                  <div className="h-full w-full bg-neutral-200" />
                )}
              </div>
              <span className="mt-1.5 text-xs font-medium text-neutral-700 line-clamp-2 leading-tight">
                {item.title}
              </span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-accent-500">
                {formatCurrency(item.price)}
              </span>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex flex-col items-center justify-center text-center aspect-square max-w-20 sm:max-w-24 mx-auto rounded-lg border-2 border-dashed border-neutral-200 w-full"
            >
              <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-primary-400" />
              <span className="text-xs text-neutral-400 mt-1">Add Trip</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mt-3">
          {canCompare ? (
            <Link
              href={`/trips/compare?trips=${slugParam}`}
              prefetch={false}
              className="btn-accent text-sm uppercase tracking-wide"
            >
              Compare Now
            </Link>
          ) : (
            <span className="btn-disabled text-sm">
              Select {2 - items.length} more
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
