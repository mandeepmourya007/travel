'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, X } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import {
  formatCurrency,
  formatDateRange,
  getTripDuration,
  getSeatsLeft,
  formatSeatsLeft,
  isSeatsLeftUrgent,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripDetail } from '@shared/types/trip.types'

interface TripComparisonTableProps {
  trips: TripDetail[]
  onRemove?: (slug: string) => void
}

/**
 * Smartprix-style side-by-side comparison table for up to 3 trips.
 *
 * Renders a product header (images + price + organizer) followed by
 * categorised comparison rows: Rating, Price, Destination, Dates,
 * Group Size, Booking Mode, Inclusions, Cancellation, and CTA.
 *
 * Winner cells (best price, best rating, flexible cancellation) are
 * highlighted with a `success-50` background.
 */
export function TripComparisonTable({ trips, onRemove }: TripComparisonTableProps) {
  if (trips.length === 0) return null

  const bestPrice = Math.min(...trips.map((t) => t.pricePerPerson))
  const bestRating = Math.max(...trips.map((t) => t.organizer.rating))
  const colCount = trips.length

  return (
    <div className="w-full">
      {/* ── Product header: side-by-side cards with "vs" ── */}
      <div
        className="relative grid gap-2 sm:gap-4 px-1 sm:px-0"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {trips.map((trip, idx) => (
          <div key={trip.id} className="relative flex flex-col items-center text-center">
            {/* "vs" badge between items */}
            {idx > 0 && (
              <span className="absolute -left-3 sm:-left-5 top-1/3 z-10 bg-white border border-neutral-200 text-xs font-semibold text-neutral-400 rounded-full w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center shadow-sm">
                vs
              </span>
            )}
            {/* Remove button */}
            {onRemove && (
              <button
                onClick={() => onRemove(trip.slug)}
                className="absolute -top-1 -right-1 z-10 rounded-full bg-neutral-200 p-0.5 sm:p-1 text-neutral-500 hover:bg-neutral-300 transition-colors"
                aria-label={`Remove ${trip.title}`}
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}
            {/* Image */}
            <div className="relative w-full aspect-square max-w-36 sm:max-w-44 rounded-lg overflow-hidden bg-neutral-100 mx-auto">
              <Image
                src={trip.photos[0] || '/placeholder-trip.jpg'}
                alt={trip.title}
                fill
                sizes="176px"
                quality={60}
                className="object-cover"
              />
            </div>
            {/* Name + Price */}
            <Link
              href={`/trips/${trip.slug}`}
              prefetch={false}
              className="mt-2 font-display text-xs sm:text-sm font-bold text-neutral-800 line-clamp-2 hover:text-primary-600 transition-colors leading-tight"
            >
              {trip.title}
            </Link>
            <span
              className={cn(
                'mt-1 text-sm sm:text-base font-bold',
                trip.pricePerPerson === bestPrice ? 'text-success-500' : 'text-neutral-800',
              )}
            >
              {formatCurrency(trip.pricePerPerson)}
            </span>
            <div className="mt-0.5 flex items-center justify-center gap-1">
              <span className="text-xs text-neutral-500 truncate">
                {trip.organizer.businessName}
              </span>
              {trip.organizer.verified && (
                <CheckCircle className="h-3 w-3 text-primary-500 shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Comparison table (Smartprix-style) ── */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {/* Rating */}
            <SectionHeader label="Rating" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Rating</td>
              {trips.map((trip) => (
                <td
                  key={trip.id}
                  className={cn(valueCell, trip.organizer.rating === bestRating && winnerCell)}
                >
                  <StarRating rating={trip.organizer.rating} showValue count={trip.organizer.totalReviews} size="sm" />
                  {trip.organizer.rating === bestRating && (
                    <div className="text-xs text-success-500 font-medium mt-0.5">Best Rated</div>
                  )}
                </td>
              ))}
            </tr>

            {/* Price */}
            <SectionHeader label="Price" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Price</td>
              {trips.map((trip) => (
                <td
                  key={trip.id}
                  className={cn(valueCell, trip.pricePerPerson === bestPrice && winnerCell)}
                >
                  <span className="font-bold text-sm sm:text-base">{formatCurrency(trip.pricePerPerson)}</span>
                  <span className="text-xs text-neutral-400 ml-0.5">/person</span>
                  {trip.pricePerPerson === bestPrice && (
                    <div className="text-xs text-success-500 font-medium mt-0.5">Best Value</div>
                  )}
                </td>
              ))}
            </tr>

            {/* Destination */}
            <SectionHeader label="Destination" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Destination</td>
              {trips.map((trip) => (
                <td key={trip.id} className={valueCell}>
                  <span className="text-xs sm:text-sm">{trip.destination.name}</span>
                  <div className="mt-0.5">
                    <span className="inline-block text-xs px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                      {trip.tripTypeLabel}
                    </span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Dates */}
            <SectionHeader label="Dates" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Dates</td>
              {trips.map((trip) => (
                <td key={trip.id} className={valueCell}>
                  <span className="text-xs sm:text-sm">{formatDateRange(trip.startDate, trip.endDate)}</span>
                  <div className="mt-0.5 text-xs text-neutral-500">{getTripDuration(trip.startDate, trip.endDate)}</div>
                </td>
              ))}
            </tr>

            {/* Group Size */}
            <SectionHeader label="Group Size" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Group Size</td>
              {trips.map((trip) => {
                const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
                return (
                  <td key={trip.id} className={valueCell}>
                    <span className="text-xs sm:text-sm">{trip.maxGroupSize} people</span>
                    <div className={cn('text-xs font-medium mt-0.5', isSeatsLeftUrgent(seatsLeft) ? 'text-accent-500' : 'text-neutral-500')}>
                      {formatSeatsLeft(seatsLeft)}
                    </div>
                  </td>
                )
              })}
            </tr>

            {/* Booking */}
            <SectionHeader label="Booking" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Booking</td>
              {trips.map((trip) => (
                <td key={trip.id} className={valueCell}>
                  <span
                    className={cn(
                      'inline-block text-xs px-2 py-0.5 rounded-full font-semibold',
                      trip.bookingMode === 'INSTANT'
                        ? 'bg-success-50 text-success-500'
                        : 'bg-warning-50 text-warning-500',
                    )}
                  >
                    {trip.bookingMode === 'INSTANT' ? 'Instant Book' : 'Request Based'}
                  </span>
                </td>
              ))}
            </tr>

            {/* Includes */}
            <SectionHeader label="Includes" colSpan={colCount + 1} />
            <tr>
              <td className={cn(headingCell, 'align-top')}>Includes</td>
              {trips.map((trip) => (
                <td key={trip.id} className={cn(valueCell, 'align-top')}>
                  {trip.inclusions && trip.inclusions.length > 0 ? (
                    <ul className="space-y-1">
                      {trip.inclusions.map((item, i) => (
                        <li key={i} className="flex items-start gap-1 text-xs text-neutral-600">
                          <CheckCircle className="h-3 w-3 text-success-500 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-neutral-400">Not listed</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Cancellation */}
            <SectionHeader label="Cancellation" colSpan={colCount + 1} />
            <tr>
              <td className={headingCell}>Cancellation</td>
              {trips.map((trip) => (
                <td key={trip.id} className={cn(
                  valueCell,
                  trip.cancellationPolicy === 'FLEXIBLE' && winnerCell,
                )}>
                  <span
                    className={cn(
                      'inline-block text-xs px-2 py-0.5 rounded-full font-semibold',
                      trip.cancellationPolicy === 'FLEXIBLE'
                        ? 'bg-success-50 text-success-500'
                        : trip.cancellationPolicy === 'MODERATE'
                          ? 'bg-warning-50 text-warning-500'
                          : 'bg-error-50 text-error-500',
                    )}
                  >
                    {cancellationLabel(trip.cancellationPolicy)}
                  </span>
                </td>
              ))}
            </tr>

            {/* CTA row */}
            <tr>
              <td className="p-2" />
              {trips.map((trip) => {
                const seatsLeft = getSeatsLeft(trip.maxGroupSize, trip.currentBookings)
                return (
                  <td key={trip.id} className="p-2 text-center">
                    {seatsLeft === 0 ? (
                      <span className="btn-disabled w-full text-center block text-xs sm:text-sm">
                        Fully Booked
                      </span>
                    ) : (
                      <Link
                        href={`/trips/${trip.slug}/book`}
                        prefetch={false}
                        className="btn-primary w-full text-center block text-xs sm:text-sm"
                      >
                        {trip.bookingMode === 'INSTANT' ? 'Book Now' : 'Request to Join'}
                      </Link>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────

const headingCell = 'px-2 sm:px-4 py-2 sm:py-3 text-xs font-medium text-neutral-500 border-b border-neutral-100 whitespace-nowrap'
const valueCell = 'px-2 sm:px-4 py-2 sm:py-3 text-center border-b border-neutral-100'
const winnerCell = 'bg-success-50/60'

function cancellationLabel(policy: string): string {
  const labels: Record<string, string> = {
    FLEXIBLE: 'Free cancel 48h',
    MODERATE: '50% after 72h',
    STRICT: 'No refunds',
  }
  return labels[policy] || policy
}

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-neutral-50 px-2 sm:px-4 py-2 text-center">
        <span className="text-xs sm:text-sm font-semibold text-neutral-700">{label}</span>
      </td>
    </tr>
  )
}
