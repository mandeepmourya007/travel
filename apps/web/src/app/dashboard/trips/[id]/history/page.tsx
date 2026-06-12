'use client'

import { useParams } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import { Spinner } from '@/components/shared/spinner'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import type { TripEditHistoryItem } from '@shared/types/trip.types'

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
                {entry.changedFields.map((field) => (
                  <span key={field} className="badge badge-info text-xs">
                    {field}
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
