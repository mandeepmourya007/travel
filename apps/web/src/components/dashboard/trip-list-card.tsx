'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Edit, Eye, BookOpen, BookX, EyeOff, Trash2, History, Users, Wallet, Star, Armchair, Lock } from 'lucide-react'
import { Modal } from '@/components/shared/modal'
import { formatDateRange, formatCurrency } from '@/lib/format'
import { slugify } from '@shared/utils/slug'
import type { OrganizerTripListItem, TripStatus } from '@shared/types/trip.types'

const STATUS_BADGE: Record<TripStatus, string> = {
  DRAFT: 'badge badge-warning',
  ACTIVE: 'badge badge-success',
  FULL: 'badge badge-primary',
  COMPLETED: 'badge badge-neutral',
  CANCELLED: 'badge badge-error',
}

interface TripListCardProps {
  trip: OrganizerTripListItem
  onPublish?: (id: string) => void
  onDelete?: (id: string) => void
  onSetBookingPause?: (id: string, paused: boolean, reason: string | undefined, slug: string) => void
  onSetVisibility?: (id: string, hidden: boolean, reason: string | undefined, slug: string) => void
}

export function TripListCard({ trip, onPublish, onDelete, onSetBookingPause, onSetVisibility }: TripListCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [showHideModal, setShowHideModal] = useState(false)
  const [modalReason, setModalReason] = useState('')

  const coverPhoto = trip.photos[0]

  const canPublish = trip.status === 'DRAFT' && !!onPublish
  const canDelete = (trip.status === 'DRAFT' || trip.status === 'ACTIVE') && !!onDelete
  const canToggleBookings = trip.status === 'ACTIVE' && !!onSetBookingPause
  const bookingsAdminLocked = trip.bookingsPausedBy === 'ADMIN'
  const hiddenAdminLocked = trip.hiddenBy === 'ADMIN'
  const canToggleVisibility = !!onSetVisibility

  function handlePauseClick() {
    if (!canToggleBookings) return
    if (trip.acceptingBookings) {
      setModalReason('')
      setShowPauseModal(true)
    } else {
      // Resume — no modal needed unless admin-locked
      onSetBookingPause!(trip.id, false, undefined, trip.slug)
    }
  }

  function handleHideClick() {
    if (!canToggleVisibility) return
    if (!trip.isHidden) {
      setModalReason('')
      setShowHideModal(true)
    } else {
      onSetVisibility!(trip.id, false, undefined, trip.slug)
    }
  }

  const pauseButtonTitle = !canToggleBookings
    ? 'Only ACTIVE trips can change booking status'
    : bookingsAdminLocked && !trip.acceptingBookings
      ? 'Paused by admin — contact support to resume'
      : trip.acceptingBookings
        ? 'Stop Bookings'
        : 'Resume Bookings'

  const hideButtonTitle = !canToggleVisibility
    ? 'Cannot toggle visibility'
    : hiddenAdminLocked
      ? 'Hidden by admin — contact support to unhide'
      : trip.isHidden
        ? 'Make Visible'
        : 'Hide Trip'

  const ToggleBookingsIcon = trip.acceptingBookings ? BookX : BookOpen
  const VisibilityIcon = trip.isHidden ? Eye : EyeOff
  const pauseIsAdminLocked = bookingsAdminLocked && !trip.acceptingBookings
  const hideIsAdminLocked = hiddenAdminLocked && trip.isHidden

  function renderActionButtons() {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/dashboard/trips/${trip.id}/edit`} prefetch={false} className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs">
          <Edit className="h-3.5 w-3.5" /> Edit
        </Link>
        <Link href={`/trips/${trip.slug}`} prefetch={false} className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" /> Preview
        </Link>
        <Link href={`/dashboard/trips/${trip.id}/history`} prefetch={false} className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs">
          <History className="h-3.5 w-3.5" /> History
        </Link>
        <button
          onClick={handlePauseClick}
          disabled={!canToggleBookings || pauseIsAdminLocked}
          className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={pauseIsAdminLocked ? pauseButtonTitle : undefined}
        >
          {pauseIsAdminLocked
            ? <><Lock className="h-3.5 w-3.5 text-warning-500" /> Locked by Admin</>
            : <><ToggleBookingsIcon className="h-3.5 w-3.5" /> {trip.acceptingBookings ? 'Stop Bookings' : 'Resume Bookings'}</>
          }
        </button>
        <button
          onClick={handleHideClick}
          disabled={!canToggleVisibility || hideIsAdminLocked}
          className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={hideIsAdminLocked ? hideButtonTitle : undefined}
        >
          {hideIsAdminLocked
            ? <><Lock className="h-3.5 w-3.5 text-warning-500" /> Hidden by Admin</>
            : <><VisibilityIcon className="h-3.5 w-3.5" /> {trip.isHidden ? 'Make Visible' : 'Hide Trip'}</>
          }
        </button>
        <button
          onClick={() => { if (canDelete) setShowDeleteModal(true) }}
          disabled={!canDelete}
          className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-error-600 hover:bg-error-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={canDelete ? undefined : 'Only DRAFT or ACTIVE trips can be deleted'}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="card flex flex-col gap-4 p-4 md:flex-row">
        {/* Cover thumbnail */}
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:h-24 md:h-28 md:w-36">
          {coverPhoto ? (
            <Image
              src={coverPhoto}
              alt={trip.title}
              fill
              sizes="(max-width: 768px) 100vw, 144px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300 text-sm">
              No photo
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="truncate font-semibold text-neutral-800">{trip.title}</h3>
                <span className={`shrink-0 ${STATUS_BADGE[trip.status]}`}>{trip.status}</span>
                {trip.status === 'ACTIVE' && !trip.acceptingBookings && (
                  <span className="badge badge-warning text-xs shrink-0" title={trip.bookingsPausedReason ?? undefined}>
                    {bookingsAdminLocked ? '🔒 Bookings Closed (Admin)' : 'Bookings Closed'}
                  </span>
                )}
                {trip.isHidden && (
                  <span className="badge badge-neutral text-xs shrink-0">
                    {hiddenAdminLocked ? '🔒 Hidden (Admin)' : 'Hidden'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {trip.destination.name} &middot; {formatDateRange(trip.startDate, trip.endDate)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span className="font-mono text-neutral-700">{formatCurrency(trip.pricePerPerson)}</span>
                <span>{trip.currentBookings}/{trip.maxGroupSize} booked</span>
              </div>
              {bookingsAdminLocked && !trip.acceptingBookings && (
                <p className="mt-1 text-xs text-warning-600">Bookings paused by admin — contact support to resume</p>
              )}
              {hiddenAdminLocked && trip.isHidden && (
                <p className="mt-1 text-xs text-warning-600">Trip hidden by admin — contact support to unhide</p>
              )}
            </div>
          </div>

          {/* Primary action links */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onPublish?.(trip.id)}
              disabled={!canPublish}
              className="btn-primary inline-flex items-center justify-center py-1.5 px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={canPublish ? 'Publish Trip' : 'Only DRAFT trips can be published'}
            >
              Publish
            </button>
            <Link href={`/dashboard/trips/${trip.id}/users?trip=${slugify(trip.title)}`} prefetch={false} className="btn-outline inline-flex items-center justify-center gap-2.5 py-1.5 px-3 text-sm">
              <Users className="h-4 w-4 shrink-0" /> Participants{' '}
              <span className="font-mono text-xs text-neutral-500">
                ({trip.confirmedGroupCount}{(trip.pendingRequestCount + trip.pendingPaymentCount) > 0 ? `+${trip.pendingRequestCount + trip.pendingPaymentCount}` : ''})
              </span>
            </Link>
            <Link href={`/dashboard/trips/${trip.id}/payments?trip=${slugify(trip.title)}`} prefetch={false} className="btn-outline inline-flex items-center justify-center gap-2.5 py-1.5 px-3 text-sm">
              <Wallet className="h-4 w-4 shrink-0" /> Payments
            </Link>
            <Link href={`/dashboard/trips/${trip.id}/reviews?trip=${slugify(trip.title)}`} prefetch={false} className="btn-outline inline-flex items-center justify-center gap-2.5 py-1.5 px-3 text-sm">
              <Star className="h-4 w-4 shrink-0" /> Reviews <span className="font-mono text-xs text-neutral-500">({trip.reviewCount})</span>
            </Link>
            <Link href={`/dashboard/trips/${trip.id}/vehicle`} prefetch={false} className="btn-outline inline-flex items-center justify-center gap-2.5 py-1.5 px-3 text-sm">
              <Armchair className="h-4 w-4 shrink-0" /> Seats
            </Link>
          </div>

          {/* Trip management actions — labeled row */}
          <div className="mt-2 border-t border-neutral-100 pt-2">
            {renderActionButtons()}
          </div>
        </div>
      </div>

      {/* Pause bookings modal */}
      <Modal open={showPauseModal} onClose={() => setShowPauseModal(false)} title="Stop Bookings">
        <p className="text-sm text-neutral-600">
          Stop new bookings and join-requests for <strong>{trip.title}</strong>. You can optionally add a reason visible to travelers.
        </p>
        <div className="mt-4">
          <label htmlFor="pause-reason" className="block text-sm font-medium text-neutral-700 mb-1">
            Reason (optional)
          </label>
          <textarea
            id="pause-reason"
            rows={3}
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            placeholder="e.g. Reopening after availability check…"
            maxLength={500}
            className="input-field w-full resize-none text-sm"
          />
          <p className="mt-1 text-xs text-neutral-400 text-right">{modalReason.length}/500</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setShowPauseModal(false)} className="btn-ghost">Cancel</button>
          <button
            onClick={() => {
              onSetBookingPause!(trip.id, true, modalReason.trim() || undefined, trip.slug)
              setShowPauseModal(false)
            }}
            className="btn-danger"
          >
            Stop Bookings
          </button>
        </div>
      </Modal>

      {/* Hide trip modal */}
      <Modal open={showHideModal} onClose={() => setShowHideModal(false)} title="Hide Trip">
        <p className="text-sm text-neutral-600">
          Hide <strong>{trip.title}</strong> from public search and trip listings. Existing bookings are unaffected.
          You can add an internal note (not shown to travelers).
        </p>
        <div className="mt-4">
          <label htmlFor="hide-reason" className="block text-sm font-medium text-neutral-700 mb-1">
            Note (optional, internal only)
          </label>
          <textarea
            id="hide-reason"
            rows={3}
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            placeholder="e.g. Rescheduling dates…"
            maxLength={500}
            className="input-field w-full resize-none text-sm"
          />
          <p className="mt-1 text-xs text-neutral-400 text-right">{modalReason.length}/500</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setShowHideModal(false)} className="btn-ghost">Cancel</button>
          <button
            onClick={() => {
              onSetVisibility!(trip.id, true, modalReason.trim() || undefined, trip.slug)
              setShowHideModal(false)
            }}
            className="btn-primary"
          >
            Hide Trip
          </button>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Trip">
        <p className="text-sm text-neutral-600">
          Are you sure you want to delete <strong>{trip.title}</strong>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowDeleteModal(false)} className="btn-ghost">Cancel</button>
          <button
            onClick={() => { onDelete?.(trip.id); setShowDeleteModal(false) }}
            className="btn-danger"
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  )
}

export function TripListCardSkeleton() {
  return (
    <div className="card-static flex flex-col gap-4 p-4 md:flex-row md:items-center">
      <div className="skeleton h-32 w-full shrink-0 sm:h-24 md:h-20 md:w-28" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-4 w-24" />
      </div>
    </div>
  )
}
