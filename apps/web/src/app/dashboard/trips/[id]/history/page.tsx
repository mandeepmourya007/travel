'use client'

import { useParams } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import { Spinner } from '@/components/shared/spinner'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import type { TripEditHistoryItem, TripFieldChange } from '@shared/types/trip.types'

/** Formats a field's previous value into a short human-readable string for the history badge. */
function formatPreviousValue(value: unknown): string {
  if (value === null || value === undefined) return 'empty'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty'
    // Transfer points (pickupPoints/dropPoints) — show labels, they're the useful part of "what changed"
    if (value.every((v) => v && typeof v === 'object' && typeof (v as Record<string, unknown>).label === 'string')) {
      return value.map((v) => (v as { label: string }).label).join(', ')
    }
    if (value.length > 2 || value.some((v) => typeof v === 'object' && v !== null)) {
      return `${value.length} item${value.length === 1 ? '' : 's'}`
    }
    return value.map((v) => String(v)).join(', ')
  }
  if (typeof value === 'object') return '(complex value)'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString()
  }
  return String(value)
}

export default function TripEditHistoryPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: tripKeys.editHistory(id),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: TripEditHistoryItem[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/trips/${id}/history`)
      return res.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Loading history..." />
      </div>
    )
  }

  if (error) return <ErrorState onRetry={() => refetch()} />

  const entries = data?.data ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/trips" className="btn-ghost p-2" aria-label="Back to my trips">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="font-display text-2xl font-bold text-neutral-900">Edit History</h2>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          message="No edit history yet. Changes to published trips are tracked here."
          icon={<Clock className="mx-auto h-12 w-12 text-neutral-300" />}
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="card-static p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">
                    {entry.editedBy.name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.changes.map(({ field, previousValue }: TripFieldChange) => (
                  <span key={field} className="badge badge-info text-xs">
                    {field}
                    <span className="ml-1 font-normal text-info-700">
                      was: {formatPreviousValue(previousValue)}
                    </span>
                  </span>
                ))}
              </div>
              {entry.editNote && (
                <p className="mt-2 text-sm text-neutral-600 italic">{entry.editNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
