'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Map } from 'lucide-react'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { slugify } from '@shared/utils/slug'
import { RequestCard, ParticipantCardSkeleton } from '@/components/dashboard/trip-users/participant-card'
import { RequestActionModal } from '@/components/dashboard/trip-users/request-action-modal'
import { useAllPendingRequests } from '@/hooks/use-all-pending-requests'
import { useRespondToRequest } from '@/hooks/use-respond-request'
import type { PendingRequestWithTrip, TripRequestListItem } from '@shared/types/trip-request.types'

// ── Helpers ──────────────────────────────────────────────

interface TripGroup {
  trip: { id: string; title: string; slug: string }
  requests: PendingRequestWithTrip[]
}

function groupByTrip(requests: PendingRequestWithTrip[]): TripGroup[] {
  const map: Record<string, TripGroup> = {}
  for (const r of requests) {
    const existing = map[r.trip.id]
    if (existing) existing.requests.push(r)
    else map[r.trip.id] = { trip: r.trip, requests: [r] }
  }
  return Object.values(map)
}

// ── Page ─────────────────────────────────────────────────

export default function PendingRequestsPage() {
  const { data, isLoading, error, refetch } = useAllPendingRequests()
  const respondMutation = useRespondToRequest()

  // ── Action Modal state ──────────────────────────────
  const [actionRequest, setActionRequest] = useState<TripRequestListItem | null>(null)
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [actionTripId, setActionTripId] = useState<string>('')

  const handleApprove = (req: TripRequestListItem, tripId: string) => {
    setActionRequest(req)
    setActionType('APPROVED')
    setActionTripId(tripId)
  }

  const handleReject = (req: TripRequestListItem, tripId: string) => {
    setActionRequest(req)
    setActionType('REJECTED')
    setActionTripId(tripId)
  }

  const handleConfirmAction = (requestId: string, action: 'APPROVED' | 'REJECTED', note?: string) => {
    respondMutation.mutate(
      { tripId: actionTripId, requestId, status: action, rejectionReason: note },
      {
        onSuccess: () => {
          setActionRequest(null)
          setActionType(null)
          setActionTripId('')
        },
      },
    )
  }

  const groups = data ? groupByTrip(data) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-2" aria-label="Back to dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-bold text-neutral-900">
            Pending Requests
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            All pending trip requests awaiting your response
          </p>
        </div>
      </div>

      {/* Content — 4-state pattern */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ParticipantCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load requests" message={error?.message || 'Something went wrong. Please try again.'} onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState message="No pending requests. You're all caught up!" />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.trip.id}>
              {/* Trip section header */}
              <div className="mb-3 flex items-center gap-2">
                <Map className="h-4 w-4 text-primary-400" />
                <Link
                  href={`/dashboard/trips/${group.trip.id}/users?trip=${slugify(group.trip.title)}`}
                  className="font-semibold text-neutral-800 hover:text-primary-600 transition-colors"
                >
                  {group.trip.title}
                </Link>
                <span className="badge badge-warning text-xs">
                  {group.requests.length} pending
                </span>
              </div>

              {/* Request cards */}
              <div className="space-y-3">
                {group.requests.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    onApprove={(req) => handleApprove(req, group.trip.id)}
                    onReject={(req) => handleReject(req, group.trip.id)}
                    isResponding={respondMutation.isPending}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Action Modal — reused from trip-users */}
      <RequestActionModal
        request={actionRequest}
        action={actionType}
        onConfirm={handleConfirmAction}
        onClose={() => { setActionRequest(null); setActionType(null); setActionTripId('') }}
        isPending={respondMutation.isPending}
      />
    </div>
  )
}
