'use client'

import { useEffect, useCallback } from 'react'
import { X, Users, Mail } from 'lucide-react'
import { TravelerDetailsTable } from './traveler-details-table'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/avatar'
import { formatCurrency, timeAgo } from '@/lib/format'
import type { TripBookingListItem } from '@shared/types/booking.types'
import type { TripRequestListItem } from '@shared/types/trip-request.types'

type DrawerItem =
  | { type: 'booking'; data: TripBookingListItem }
  | { type: 'request'; data: TripRequestListItem }

/** Side drawer showing full booking or request details */
interface ParticipantDrawerProps {
  item: DrawerItem | null
  onClose: () => void
}

export function ParticipantDrawer({ item, onClose }: ParticipantDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (item) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [item, handleKeyDown])

  if (!item) return null

  const user = item.data.user

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Drawer panel */}
      <div className="relative w-full max-w-md overflow-y-auto bg-white shadow-xl animate-slide-left">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-neutral-800">
            {item.type === 'booking' ? 'Booking Details' : 'Request Details'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div>
              <p className="text-lg font-bold text-neutral-800">{user.name}</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Status">
              <span className={cn(
                'badge',
                item.type === 'booking'
                  ? statusBadge((item.data as TripBookingListItem).bookingStatus)
                  : statusBadge((item.data as TripRequestListItem).status),
              )}>
                {item.type === 'booking'
                  ? (item.data as TripBookingListItem).bookingStatus.replace('_', ' ')
                  : (item.data as TripRequestListItem).status}
              </span>
            </InfoBlock>
            <InfoBlock label="Travelers">
              <span className="flex items-center gap-1 font-semibold">
                <Users className="h-4 w-4" />
                {item.type === 'booking'
                  ? (item.data as TripBookingListItem).numTravelers
                  : (item.data as TripRequestListItem).numTravelers}
              </span>
            </InfoBlock>
            {item.type === 'booking' && (
              <>
                <InfoBlock label="Amount">
                  <span className="font-mono font-semibold">
                    {formatCurrency((item.data as TripBookingListItem).totalAmount)}
                  </span>
                </InfoBlock>
                <InfoBlock label="Booking Ref">
                  <span className="font-mono text-sm">{(item.data as TripBookingListItem).bookingRef}</span>
                </InfoBlock>
              </>
            )}
            <InfoBlock label="Submitted">
              <span>{timeAgo(item.data.createdAt)}</span>
            </InfoBlock>
          </div>

          {/* Request message */}
          {item.type === 'request' && (item.data as TripRequestListItem).message && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Message</p>
              <p className="mt-1 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700 italic">
                &ldquo;{(item.data as TripRequestListItem).message}&rdquo;
              </p>
            </div>
          )}

          {/* Response note */}
          {item.type === 'request' && (item.data as TripRequestListItem).responseNote && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Response Note</p>
              <p className="mt-1 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                {(item.data as TripRequestListItem).responseNote}
              </p>
            </div>
          )}

          {/* Traveler details table — request */}
          {item.type === 'request' && (item.data as TripRequestListItem).travelerDetails && (item.data as TripRequestListItem).travelerDetails!.length > 0 && (
            <TravelerDetailsTable travelers={(item.data as TripRequestListItem).travelerDetails!} />
          )}

          {/* Traveler details table — booking */}
          {item.type === 'booking' && (item.data as TripBookingListItem).travelerDetails.length > 0 && (
            <TravelerDetailsTable travelers={(item.data as TripBookingListItem).travelerDetails} />
          )}
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      <div className="mt-1 text-neutral-800">{children}</div>
    </div>
  )
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'badge-success',
    PENDING: 'badge-warning',
    PENDING_PAYMENT: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-error',
    CANCELLED: 'badge-error',
    COMPLETED: 'badge-neutral',
    REFUNDED: 'badge-neutral',
    EXPIRED: 'badge-neutral',
  }
  return map[status] ?? ''
}
