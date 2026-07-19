'use client'

import Image from 'next/image'
import { Link2, ListChecks } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { ResellerMainLinkWithEarningsDto } from '@shared/types/reseller.types'

interface ResellerTripCardProps {
  mainLink: ResellerMainLinkWithEarningsDto
  onViewLinks: (mainLink: ResellerMainLinkWithEarningsDto) => void
  onGenerateLink: (mainLink: ResellerMainLinkWithEarningsDto) => void
}

/**
 * One card per trip shared with the reseller (= one `ResellerMainLinkWithEarningsDto`
 * row — a reseller has exactly one main link per trip). Mirrors the thumbnail+info
 * layout of `TripListCard` (`@/components/dashboard/trip-list-card`) for visual
 * consistency with the rest of the app's card conventions.
 */
export function ResellerTripCard({ mainLink, onViewLinks, onGenerateLink }: ResellerTripCardProps) {
  return (
    <div className="card flex flex-col gap-4 p-4 md:flex-row">
      {/* Cover thumbnail */}
      <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:h-24 md:h-28 md:w-36">
        {mainLink.tripPhoto ? (
          <Image
            src={mainLink.tripPhoto}
            alt={mainLink.tripTitle}
            fill
            sizes="(max-width: 768px) 100vw, 144px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-300">No photo</div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="truncate font-semibold text-neutral-800">{mainLink.tripTitle}</h3>
        <p className="mt-1 truncate text-sm text-neutral-500">{mainLink.organizerName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
          <span>{mainLink.sublinkCount} link{mainLink.sublinkCount === 1 ? '' : 's'}</span>
          <span>{mainLink.bookingCount} booking{mainLink.bookingCount === 1 ? '' : 's'}</span>
          <span className="font-semibold text-success-600">{formatCurrency(mainLink.totalMarkupAmount)}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onViewLinks(mainLink)}
            className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <ListChecks className="h-4 w-4" /> View Links
          </button>
          <button
            type="button"
            onClick={() => onGenerateLink(mainLink)}
            className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Link2 className="h-4 w-4" /> Generate Link
          </button>
        </div>
      </div>
    </div>
  )
}

export function ResellerTripCardSkeleton() {
  return (
    <div className="card-static flex flex-col gap-4 p-4 md:flex-row md:items-center">
      <div className="skeleton h-32 w-full shrink-0 sm:h-24 md:h-28 md:w-36" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-4 w-24" />
      </div>
    </div>
  )
}
