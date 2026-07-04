'use client'

import { useState } from 'react'
import { Modal } from '@/components/shared/modal'
import type { TripRequestListItem } from '@shared/types/trip-request.types'

/** Modal for approving or rejecting a trip request with optional note */
interface RequestActionModalProps {
  request: TripRequestListItem | null
  action: 'APPROVED' | 'REJECTED' | null
  onConfirm: (requestId: string, action: 'APPROVED' | 'REJECTED', note?: string) => void
  onClose: () => void
  isPending: boolean
  seatsLeft?: number
}

export function RequestActionModal({
  request,
  action,
  onConfirm,
  onClose,
  isPending,
  seatsLeft,
}: RequestActionModalProps) {
  const [note, setNote] = useState('')

  if (!request || !action) return null

  const isApprove = action === 'APPROVED'
  const tooManyTravelers = isApprove && seatsLeft !== undefined && request.numTravelers > seatsLeft

  const handleSubmit = () => {
    onConfirm(request.id, action, note.trim() || undefined)
    setNote('')
  }

  return (
    <Modal
      open={!!request && !!action}
      onClose={onClose}
      title={isApprove ? 'Approve Request' : 'Reject Request'}
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          {isApprove ? (
            <>
              Approve <strong>{request.user.name}</strong>&apos;s request for{' '}
              <strong>{request.numTravelers}</strong> traveler{request.numTravelers !== 1 ? 's' : ''}?
              They will have 48 hours to complete payment.
            </>
          ) : (
            <>
              Reject <strong>{request.user.name}</strong>&apos;s request for{' '}
              <strong>{request.numTravelers}</strong> traveler{request.numTravelers !== 1 ? 's' : ''}?
            </>
          )}
        </p>

        {request.message && (
          <div className="rounded-md bg-neutral-50 border-l-2 border-neutral-200 px-3 py-2">
            <p className="mb-1 text-xs font-medium text-neutral-400 uppercase tracking-wide">Traveler&apos;s message</p>
            <p className="max-h-32 overflow-y-auto text-sm text-neutral-700 italic leading-snug">&ldquo;{request.message}&rdquo;</p>
          </div>
        )}

        {tooManyTravelers && (
          <div className="rounded-lg bg-error-50 border border-error-200 p-3 text-sm text-error-700">
            Not enough seats! Only <strong>{seatsLeft}</strong> seat{seatsLeft !== 1 ? 's' : ''} left,
            but <strong>{request.numTravelers}</strong> requested.
          </div>
        )}

        {isApprove && seatsLeft !== undefined && !tooManyTravelers && (
          <div className="rounded-lg bg-success-50 border border-success-200 p-3 text-sm text-success-700">
            <strong>{seatsLeft}</strong> seat{seatsLeft !== 1 ? 's' : ''} available.
            After approval: <strong>{seatsLeft - request.numTravelers}</strong> remaining.
          </div>
        )}

        <div>
          <label htmlFor="action-note" className="text-sm font-medium text-neutral-700">
            {isApprove ? 'Note (optional)' : 'Reason for rejection'}
          </label>
          <textarea
            id="action-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isApprove ? 'Any message for the traveler...' : 'Please provide a reason...'}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-ghost" disabled={isPending}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending || tooManyTravelers || (!isApprove && !note.trim())}
          className={isApprove ? 'btn-primary' : 'btn-danger'}
        >
          {isPending ? 'Processing...' : isApprove ? 'Approve' : 'Reject'}
        </button>
      </div>
    </Modal>
  )
}
