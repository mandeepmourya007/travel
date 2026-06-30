import { Shield, Check, X as XIcon, MapPin } from 'lucide-react'
import { formatCurrency, getSeatsLeft } from '@/lib/format'
import { SeatsLeftBadge } from '@/components/trips/seats-left-badge'
import { TripCtaButton } from './trip-cta-button'
import type { TripDetail, TransferPoint } from '@shared/types/trip.types'

function PointsList({ title, iconColor, points }: { title: string; iconColor: string; points: TransferPoint[] }) {
  if (!points?.length) return null
  return (
    <div className="mb-3 last:mb-0">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 mb-1.5">
        <MapPin className={`h-3.5 w-3.5 ${iconColor}`} /> {title}
      </h4>
      <ul className="space-y-1">
        {points.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">{p.label}{p.time ? ` · ${p.time}` : ''}</span>
            {p.extraCharge > 0 ? (
              <span className="text-xs text-accent-600">+{formatCurrency(p.extraCharge)}</span>
            ) : (
              <span className="text-xs text-success-500">Included</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface TripBookingCardProps {
  trip: TripDetail
}

export function TripBookingCard({ trip }: TripBookingCardProps) {
  const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
  const isFull = seatsLeft === 0

  return (
    <div className="card sticky top-24 p-6">
      {/* Price */}
      <div className="mb-4">
        {trip.earlyBirdPrice ? (
          <>
            <span className="text-2xl font-bold text-accent-500">
              {formatCurrency(trip.earlyBirdPrice)}
            </span>
            <span className="text-sm text-neutral-400 line-through ml-2">
              {formatCurrency(trip.pricePerPerson)}
            </span>
          </>
        ) : (
          <span className="text-2xl font-bold text-accent-500">
            {formatCurrency(trip.pricePerPerson)}
          </span>
        )}
        <span className="text-neutral-500 text-sm ml-1">/person</span>
      </div>

      {/* Capacity bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-neutral-600">{trip.currentBookings} booked</span>
          <span className="text-neutral-400">{trip.maxGroupSize} max</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{
              width: `${Math.min(100, (trip.currentBookings / trip.maxGroupSize) * 100)}%`,
            }}
          />
        </div>
        {!isFull && (
          <SeatsLeftBadge
            maxGroupSize={trip.maxGroupSize}
            currentBookings={trip.currentBookings}
            className="mt-1"
          />
        )}
      </div>

      {/* Inclusions */}
      {trip.inclusions && trip.inclusions.length > 0 && (
        <div className="mb-4 border-t border-neutral-100 pt-4">
          <h4 className="text-sm font-semibold text-neutral-700 mb-2">Inclusions</h4>
          <ul className="space-y-1.5">
            {trip.inclusions.slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-neutral-600">
                <Check className="h-3.5 w-3.5 text-success-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exclusions */}
      {trip.exclusions && trip.exclusions.length > 0 && (
        <div className="mb-4 border-t border-neutral-100 pt-4">
          <h4 className="text-sm font-semibold text-neutral-700 mb-2">Exclusions</h4>
          <ul className="space-y-1.5">
            {trip.exclusions.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                <XIcon className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transfer Points */}
      {(trip.pickupPoints?.length > 0 || trip.dropPoints?.length > 0) && (
        <div className="mb-4 border-t border-neutral-100 pt-4">
          <PointsList title="Pickup Points" iconColor="text-primary-500" points={trip.pickupPoints} />
          <PointsList title="Drop Points" iconColor="text-neutral-400" points={trip.dropPoints} />
        </div>
      )}

      {/* CTA */}
      <TripCtaButton trip={trip} variant="card" />

      {/* SafePay trust badge */}
      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        <Shield className="h-4 w-4 text-primary-500" />
        Payment held safely via SafePay until trip completion
      </div>

      {/* Cancellation */}
      {trip.cancellationPolicy && (
        <p className="mt-2 text-xs text-neutral-400">
          Cancellation: {trip.cancellationPolicy.replace(/_/g, ' ').toLowerCase()}
        </p>
      )}
    </div>
  )
}
