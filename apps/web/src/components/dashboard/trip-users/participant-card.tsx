'use client'

import { useState } from 'react'
import { Check, X, Users, Eye, ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { Avatar } from '@/components/shared/avatar'
import { cn } from '@/lib/utils'
import { formatCurrency, timeAgo } from '@/lib/format'
import type { TripBookingListItem } from '@shared/types/booking.types'
import type { TripRequestListItem } from '@shared/types/trip-request.types'

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'badge badge-success',
  PENDING: 'badge badge-warning',
  PENDING_PAYMENT: 'badge badge-warning',
  CANCELLED: 'badge badge-error',
  COMPLETED: 'badge badge-neutral',
  REFUNDED: 'badge badge-neutral',
  APPROVED: 'badge badge-success',
  REJECTED: 'badge badge-error',
  EXPIRED: 'badge badge-neutral',
}

// ── Booking Card ────────────────────────────────────────

/** Displays a single booking in the organizer's participant list */
interface BookingCardProps {
  booking: TripBookingListItem
  onViewDetails: (booking: TripBookingListItem) => void
}

export function BookingCard({ booking, onViewDetails }: BookingCardProps) {
  return (
    <div
      onClick={() => onViewDetails(booking)}
      className="card flex cursor-pointer items-center gap-4 p-4 transition-shadow hover:shadow-card-hover"
    >
      <Avatar name={booking.user.name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-neutral-800">{booking.user.name}</p>
          <span className={STATUS_COLORS[booking.bookingStatus] ?? 'badge'}>
            {booking.bookingStatus.replace('_', ' ')}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">
          {booking.user.email}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {booking.numTravelers} traveler{booking.numTravelers !== 1 ? 's' : ''}
          </span>
          <span className="font-mono text-neutral-700">{formatCurrency(booking.totalAmount)}</span>
          <span className="text-xs">{timeAgo(booking.createdAt)}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onViewDetails(booking) }}
        className="btn-ghost shrink-0 p-2"
        aria-label="View booking details"
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Request Card ────────────────────────────────────────

/** Displays a single trip request in the organizer's participant list */
interface RequestCardProps {
  request: TripRequestListItem
  onApprove: (request: TripRequestListItem) => void
  onReject: (request: TripRequestListItem) => void
  onViewDetails: (request: TripRequestListItem) => void
  isResponding?: boolean
}

export function RequestCard({ request, onApprove, onReject, onViewDetails, isResponding }: RequestCardProps) {
  const isPending = request.status === 'PENDING'
  const [showTravelers, setShowTravelers] = useState(false)
  const travelers = request.travelerDetails

  return (
    <div
      className={cn(
        'card p-4 transition-shadow hover:shadow-card-hover',
        isPending && 'border-l-4 border-l-warning-400',
      )}
    >
      <div className="flex items-center gap-4">
        <Avatar name={request.user.name} size="md" color={isPending ? 'highlight' : 'primary'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-neutral-800">{request.user.name}</p>
            <span className={STATUS_COLORS[request.status] ?? 'badge'}>
              {request.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {request.user.email}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {request.numTravelers} traveler{request.numTravelers !== 1 ? 's' : ''}
            </span>
            {request.message && (
              <span className="truncate max-w-[200px] italic text-neutral-400">
                &ldquo;{request.message}&rdquo;
              </span>
            )}
            <span className="text-xs">{timeAgo(request.createdAt)}</span>
          </div>
        </div>

        {isPending ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(request) }}
              disabled={isResponding}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-50 text-success-600 transition-colors hover:bg-success-100 disabled:opacity-50"
              aria-label="Approve request"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(request) }}
              disabled={isResponding}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-error-50 text-error-500 transition-colors hover:bg-error-100 disabled:opacity-50"
              aria-label="Reject request"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(request) }}
            className="btn-ghost shrink-0 p-2"
            aria-label="View request details"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expandable traveler details */}
      {travelers && travelers.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowTravelers((v) => !v) }}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            {showTravelers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showTravelers ? 'Hide' : 'Show'} traveler details
          </button>
          {showTravelers && (
            <div className="mt-2 space-y-1.5">
              {travelers.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-1.5 text-sm">
                  <span className="font-medium text-neutral-700">
                    {t.name} {t.isPrimary && <span className="text-xs text-primary-500">(Primary)</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>{t.age}y {t.gender ? <>&middot; {t.gender.charAt(0) + t.gender.slice(1).toLowerCase()}</> : null}</span>
                    {t.phone && <span className="inline-flex items-center gap-0.5"><Phone className="h-3 w-3" />{t.phone}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────

export function ParticipantCardSkeleton() {
  return (
    <div className="card-static flex items-center gap-4 p-4">
      <div className="skeleton h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton h-3 w-48" />
        <div className="skeleton h-3 w-24" />
      </div>
    </div>
  )
}
