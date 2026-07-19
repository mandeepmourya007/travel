'use client'

import { useState } from 'react'
import { Copy, Check, Eye } from 'lucide-react'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { useToast } from '@/components/shared/toast'
import { formatCurrency } from '@/lib/format'
import type { ResellerLeadRow } from '@shared/types/reseller.types'

/** Full, traveler-facing shareable sublink URL — the only kind of "link" that
 * actually resolves to a bookable price; the main link is purely an internal
 * organizer→reseller invite record and is never shown as a token/URL. */
function sublinkShareUrl(tripSlug: string, sublinkToken: string) {
  return `${window.location.origin}/trips/${tripSlug}?ref=${sublinkToken}`
}

interface ResellerLeadsTableProps {
  leads: ResellerLeadRow[]
  /** Identity column shown first: 'reseller' (admin view), 'organizer' (reseller's own
   * view), or omitted/null when the viewer already owns the trips (organizer's own page). */
  identityColumn?: 'reseller' | 'organizer' | null
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  onViewBookings: (sublinkId: string) => void
  /** Pass through the leads query's pagination metadata to render page controls below the table. */
  pagination?: { page: number; limit: number; total: number }
  onPageChange?: (page: number) => void
  /** Opt-in page-size selector — pass both to render a "X per page" control alongside
   * the page controls. Caller owns resetting the page back to 1 on change. */
  onLimitChange?: (limit: number) => void
}

/**
 * One flat table, reused across admin/organizer/reseller reseller pages —
 * one row per sublink (the real unit: has a markup rate, a real shareable
 * URL, its own bookings). Column order: identity (if any), Trip Name,
 * Booking Count, Earnings, Link (copy), Views (bookings drill-down).
 */
export function ResellerLeadsTable({
  leads,
  identityColumn = null,
  isLoading,
  error,
  onRetry,
  onViewBookings,
  pagination,
  onPageChange,
  onLimitChange,
}: ResellerLeadsTableProps) {
  const { toast } = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleCopy(id: string, url: string) {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast({ variant: 'success', title: 'Link copied' })
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
  }

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
  }

  if (error) {
    return <ErrorState title="Failed to load leads" message={error?.message} onRetry={onRetry} />
  }

  if (!leads.length) {
    return <EmptyState message="No leads found." />
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-neutral-200 bg-neutral-50">
            <tr>
              {identityColumn === 'reseller' && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Reseller</th>
              )}
              {identityColumn === 'organizer' && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Organizer</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Trip Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Booking Count</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Earnings</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Link</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.map((l) => {
              const url = sublinkShareUrl(l.tripSlug, l.sublinkToken)
              return (
                <tr key={l.sublinkId} className="hover:bg-neutral-50">
                  {identityColumn === 'reseller' && (
                    <td className="px-4 py-3 text-neutral-600">
                      <span className="max-w-[180px] truncate" title={l.resellerName ?? l.resellerEmail}>
                        {l.resellerName ?? l.resellerEmail}
                      </span>
                    </td>
                  )}
                  {identityColumn === 'organizer' && (
                    <td className="px-4 py-3 text-neutral-600">
                      <span className="max-w-[180px] truncate" title={l.organizerName}>{l.organizerName}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-semibold text-neutral-800">
                    <span className="max-w-[280px] truncate" title={l.tripTitle}>{l.tripTitle}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{l.bookingCount}</td>
                  <td className="px-4 py-3 font-bold text-success-600">{formatCurrency(l.totalMarkupAmount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="max-w-[220px] truncate font-mono text-xs text-neutral-500" title={url}>{url}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(l.sublinkId, url)}
                        className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-xs"
                      >
                        {copiedId === l.sublinkId ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === l.sublinkId ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onViewBookings(l.sublinkId)}
                      className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination && onPageChange && Math.ceil(pagination.total / pagination.limit) > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={Math.max(1, Math.ceil(pagination.total / pagination.limit))}
          total={pagination.total}
          onPageChange={onPageChange}
          {...(onLimitChange ? { limit: pagination.limit, onLimitChange } : {})}
        />
      )}
    </div>
  )
}
