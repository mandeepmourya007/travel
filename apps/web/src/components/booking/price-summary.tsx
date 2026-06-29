'use client'

import { Shield } from 'lucide-react'
import { formatCurrency, formatDateRange } from '@/lib/format'
import { getEffectivePrice } from '@/lib/trip-utils'
import type { TripDetail, TransferPoint } from '@shared/types/trip.types'

/** Props for price breakdown sidebar card */
interface PriceSummaryProps {
  trip: TripDetail
  numTravelers: number
  selectedPickupPoint?: TransferPoint
  selectedDropPoint?: TransferPoint
}

const TRUST_BADGES = [
  'Your money is held safely in escrow',
  'Released to organizer after trip completion',
  'Full refund if organizer cancels',
] as const

export function PriceSummary({ trip, numTravelers, selectedPickupPoint, selectedDropPoint }: PriceSummaryProps) {
  const isEarlyBird =
    trip.earlyBirdPrice &&
    trip.earlyBirdDeadline &&
    new Date(trip.earlyBirdDeadline) > new Date()

  const basePerPerson = getEffectivePrice(trip)
  const baseTotal = basePerPerson * numTravelers

  const pickupCharge = selectedPickupPoint?.extraCharge ?? 0
  const dropCharge = selectedDropPoint?.extraCharge ?? 0
  const pickupExtra = pickupCharge > 0 ? pickupCharge * numTravelers : 0
  const dropExtra = dropCharge > 0 ? dropCharge * numTravelers : 0
  const total = baseTotal + pickupExtra + dropExtra

  return (
    <div className="card p-5 space-y-4 sticky top-4">
      {/* Trip info */}
      <div>
        <h3 className="font-display font-semibold text-neutral-900">{trip.title}</h3>
        <p className="text-sm text-neutral-500 mt-1">
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>
        {trip.inclusions.length > 0 && (
          <p className="text-sm text-neutral-500 mt-1">
            {trip.inclusions.join(' + ')}
          </p>
        )}
      </div>

      <hr className="border-neutral-200" />

      {/* Price breakdown */}
      <div className="space-y-2">
        {/* Base price row */}
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">
            Base price ({formatCurrency(basePerPerson)} × {numTravelers})
          </span>
          <span className="text-neutral-900">{formatCurrency(baseTotal)}</span>
        </div>

        {isEarlyBird && (
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400 line-through">
              {formatCurrency(trip.pricePerPerson)} regular
            </span>
            <span className="text-success-500 font-medium">Early bird price</span>
          </div>
        )}

        {/* Pickup surcharge row — only shown when extraCharge > 0 */}
        {pickupExtra > 0 && selectedPickupPoint && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">
              Pickup: {selectedPickupPoint.label}
              {selectedPickupPoint.time ? ` · ${selectedPickupPoint.time}` : ''}
              <span className="text-neutral-400 text-xs ml-1">
                ({formatCurrency(pickupCharge)}/person)
              </span>
            </span>
            <span className="text-neutral-900">+{formatCurrency(pickupExtra)}</span>
          </div>
        )}

        {/* Drop surcharge row — only shown when extraCharge > 0 */}
        {dropExtra > 0 && selectedDropPoint && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">
              Drop: {selectedDropPoint.label}
              {selectedDropPoint.time ? ` · ${selectedDropPoint.time}` : ''}
              <span className="text-neutral-400 text-xs ml-1">
                ({formatCurrency(dropCharge)}/person)
              </span>
            </span>
            <span className="text-neutral-900">+{formatCurrency(dropExtra)}</span>
          </div>
        )}
      </div>

      <hr className="border-neutral-200" />

      {/* Total */}
      <div className="flex justify-between items-center">
        <span className="font-semibold text-neutral-900">Total</span>
        <span className="text-lg font-bold text-accent-500">{formatCurrency(total)}</span>
      </div>

      {/* Trust badges */}
      <div className="space-y-2 pt-2">
        {TRUST_BADGES.map((badge) => (
          <div key={badge} className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-success-500 mt-0.5 shrink-0" />
            <span className="text-xs text-neutral-600">{badge}</span>
          </div>
        ))}
      </div>

      {/* Cancellation policy */}
      <p className="text-xs text-neutral-400 pt-2">
        Cancellation: {trip.cancellationPolicy.charAt(0) + trip.cancellationPolicy.slice(1).toLowerCase().replace(/_/g, ' ')}
      </p>
    </div>
  )
}
