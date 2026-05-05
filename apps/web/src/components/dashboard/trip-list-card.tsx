'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Edit, Eye, BookOpen, BookX, Trash2, History, Users, Wallet, Star } from 'lucide-react'
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
  onToggleBookings?: (id: string) => void
}

export function TripListCard({ trip, onPublish, onDelete, onToggleBookings }: TripListCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const coverPhoto = trip.photos[0]

  // Derived permission flags — single source of truth for button states
  const canPublish = trip.status === 'DRAFT' && !!onPublish
  const canToggleBookings = trip.status === 'ACTIVE' && !!onToggleBookings
  const canDelete = (trip.status === 'DRAFT' || trip.status === 'ACTIVE') && !!onDelete

  return (
    <>
      <div className="card flex flex-col sm:flex-row sm:items-center gap-4 p-4">
        {/* Cover thumbnail */}
        <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:h-20 sm:w-28">
          {coverPhoto ? (
            <img src={coverPhoto} alt={trip.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300 text-sm">
              No photo
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-neutral-800">{trip.title}</h3>
            <span className={STATUS_BADGE[trip.status]}>{trip.status}</span>
            {trip.status === 'ACTIVE' && !trip.acceptingBookings && (
              <span className="badge badge-warning text-xs">Bookings Closed</span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {trip.destination.name} &middot; {formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span className="font-mono text-neutral-700">{formatCurrency(trip.pricePerPerson)}</span>
            <span>{trip.currentBookings}/{trip.maxGroupSize} booked</span>
          </div>
        </div>

        {/* Actions — always visible; disabled when not applicable */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Text buttons */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={() => onPublish?.(trip.id)}
              disabled={!canPublish}
              className="btn-primary inline-flex items-center justify-center py-1.5 px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={canPublish ? 'Publish Trip' : 'Only DRAFT trips can be published'}
            >
              Publish
            </button>
            <Link href={`/dashboard/trips/${trip.id}/users?trip=${slugify(trip.title)}`} className="btn-outline inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-sm">
              <Users className="h-4 w-4 shrink-0" /> Participants <span className="font-mono text-xs text-neutral-500">({trip.currentBookings})</span>
            </Link>
            <Link href={`/dashboard/trips/${trip.id}/payments?trip=${slugify(trip.title)}`} className="btn-outline inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-sm">
              <Wallet className="h-4 w-4 shrink-0" /> Payments
            </Link>
            <Link href={`/dashboard/trips/${trip.id}/reviews?trip=${slugify(trip.title)}`} className="btn-outline inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-sm">
              <Star className="h-4 w-4 shrink-0" /> Reviews <span className="font-mono text-xs text-neutral-500">({trip.reviewCount})</span>
            </Link>
          </div>
          {/* Icon buttons */}
          <div className="flex items-center gap-1">
            <Link href={`/dashboard/trips/${trip.id}/edit`} className="btn-ghost py-1.5 px-3" title="Edit">
              <Edit className="h-4 w-4" />
            </Link>
            <Link href={`/trips/${trip.slug}`} className="btn-ghost py-1.5 px-3" title="View Public Page">
              <Eye className="h-4 w-4" />
            </Link>
            <Link href={`/dashboard/trips/${trip.id}/history`} className="btn-ghost py-1.5 px-3" title="Edit History">
              <History className="h-4 w-4" />
            </Link>
            <button
              onClick={() => onToggleBookings?.(trip.id)}
              disabled={!canToggleBookings}
              className="btn-ghost py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              title={canToggleBookings ? (trip.acceptingBookings ? 'Stop Bookings' : 'Resume Bookings') : 'Only ACTIVE trips can toggle bookings'}
            >
              {trip.acceptingBookings ? <BookX className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { if (canDelete) setShowDeleteModal(true) }}
              disabled={!canDelete}
              className="btn-ghost py-1.5 px-3 text-error-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={canDelete ? 'Delete Trip' : 'Only DRAFT or ACTIVE trips can be deleted'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Trip"
      >
        <p className="text-sm text-neutral-600">
          Are you sure you want to delete <strong>{trip.title}</strong>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowDeleteModal(false)} className="btn-ghost">
            Cancel
          </button>
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
    <div className="card-static flex flex-col sm:flex-row sm:items-center gap-4 p-4">
      <div className="skeleton h-24 w-full shrink-0 sm:h-20 sm:w-28" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-4 w-24" />
      </div>
    </div>
  )
}
