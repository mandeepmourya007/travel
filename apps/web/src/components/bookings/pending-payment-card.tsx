'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, Users, Clock, CheckCircle, Hourglass } from 'lucide-react'
import { formatCurrency, formatDateRange } from '@/lib/format'
import type { MyTripRequestItem } from '@shared/types/trip-request.types'

interface PendingPaymentCardProps {
  request: MyTripRequestItem
  onPayNow: (request: MyTripRequestItem) => void
  isPaying?: boolean
}

function getTimeRemaining(expiresAt: string | null): { text: string; urgent: boolean } | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return { text: 'Expired', urgent: true }
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { text: `${days}d ${hours % 24}h left`, urgent: false }
  }
  if (hours >= 1) {
    return { text: `${hours}h ${minutes}m left`, urgent: hours < 6 }
  }
  return { text: `${minutes}m left`, urgent: true }
}

export function PendingPaymentCard({ request, onPayNow, isPaying }: PendingPaymentCardProps) {
  const { trip } = request
  const remaining = getTimeRemaining(request.approvalExpiresAt)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md md:flex-row md:gap-4 md:p-4">
      {/* Trip photo */}
      <Link
        href={`/trips/${trip.slug}`}
        className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 md:h-auto md:w-40"
      >
        {trip.photos[0] && (
          <Image
            src={trip.photos[0]}
            alt={trip.title}
            fill
            sizes="(max-width: 768px) 100vw, 160px"
            className="object-cover"
          />
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between gap-2">
        {/* Title + status badges */}
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-2">
          <Link href={`/trips/${trip.slug}`} className="text-base font-semibold text-neutral-900 hover:text-primary-600 md:text-lg">
            {trip.title}
          </Link>
          <div className="flex items-center gap-2 self-start">
            {request.status === 'APPROVED' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-500">
                <CheckCircle className="h-3 w-3" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-500">
                <Hourglass className="h-3 w-3" />
                Awaiting Approval
              </span>
            )}
            {remaining && request.status === 'APPROVED' && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  remaining.urgent
                    ? 'bg-error-50 text-error-500'
                    : 'bg-warning-50 text-warning-500'
                }`}
              >
                <Clock className="h-3 w-3" />
                {remaining.text}
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {trip.destination.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {request.numTravelers} traveler{request.numTravelers === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-neutral-400">
            by {trip.organizer.businessName}
            {trip.organizer.verified && <span className="ml-0.5 text-success-500">✓</span>}
          </span>
        </div>

        {/* Message if any */}
        {request.message && (
          <p className="text-sm text-neutral-500 italic">&ldquo;{request.message}&rdquo;</p>
        )}

        {/* Bottom: amount + Pay Now */}
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-2 md:flex-row md:items-center md:justify-between">
          <span className="text-base font-bold text-neutral-900">
            {formatCurrency(trip.pricePerPerson * request.numTravelers)}
          </span>
          <div className="flex flex-col gap-2 md:flex-row">
            {request.canPay ? (
              <button
                type="button"
                onClick={() => onPayNow(request)}
                disabled={isPaying}
                className="btn-primary py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPaying ? 'Processing...' : 'Pay Now'}
              </button>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500">
                Waiting for organizer
              </span>
            )}
            <Link
              href={`/trips/${trip.slug}`}
              className="btn-outline py-2 text-sm text-center"
            >
              View Trip
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
