'use client'

import { formatCurrency, getSeatsLeft } from '@/lib/format'
import { TripCtaButton } from './trip-cta-button'
import type { TripDetail } from '@shared/types/trip.types'

interface TripStickyBookBarProps {
  trip: TripDetail
}

export function TripStickyBookBar({ trip }: TripStickyBookBarProps) {
  const isFull = getSeatsLeft(trip.maxGroupSize, trip.currentBookings) === 0

  return (
    <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-50 lg:hidden border-t border-neutral-200 bg-white/95 backdrop-blur-md shadow-xl safe-area-bottom">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 py-3">
        {/* Price */}
        <div className="min-w-0 shrink-0">
          {trip.earlyBirdPrice ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-accent-500">
                {formatCurrency(trip.earlyBirdPrice)}
              </span>
              <span className="text-xs text-neutral-400 line-through">
                {formatCurrency(trip.pricePerPerson)}
              </span>
            </div>
          ) : (
            <span className="text-lg font-bold text-accent-500">
              {formatCurrency(trip.pricePerPerson)}
            </span>
          )}
          <span className="text-xs text-neutral-500">/person</span>
          {isFull && (
            <span className="mt-0.5 block truncate text-xs font-medium text-neutral-500">Fully booked</span>
          )}
          {!isFull && !trip.acceptingBookings && (
            <span className="mt-0.5 block truncate text-xs font-medium text-warning-600">Bookings closed</span>
          )}
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <TripCtaButton trip={trip} variant="bar" />
        </div>
      </div>
    </div>
  )
}
