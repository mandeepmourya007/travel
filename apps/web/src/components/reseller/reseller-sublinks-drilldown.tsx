'use client'

import { useState } from 'react'
import { Copy, Check, Eye, Pencil, Link2, Plus } from 'lucide-react'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Modal } from '@/components/shared/modal'
import { NumberInput } from '@/components/shared/number-input'
import { Pagination } from '@/components/shared/pagination'
import { useToast } from '@/components/shared/toast'
import { ResellerBookingList } from '@/components/reseller/reseller-booking-list'
import { useMySublinks, useCreateSublink, usePatchSublink, useSublinkBookings } from '@/hooks/use-reseller'
import { formatCurrency } from '@/lib/format'
import { RESELLER_MAX_MARKUP_AMOUNT } from '@shared/constants/reseller'
import type { ResellerMainLinkWithEarningsDto, ResellerSublinkDto } from '@shared/types/reseller.types'

/** Full, traveler-facing shareable sublink URL (mirrors the helper in `reseller-leads-table.tsx`). */
function sublinkShareUrl(tripSlug: string, sublinkToken: string) {
  return `${window.location.origin}/trips/${tripSlug}?ref=${sublinkToken}`
}

interface GenerateLinkTarget {
  token: string
  tripTitle: string
  tripSlug: string
}

interface GenerateLinkModalProps {
  open: boolean
  onClose: () => void
  mainLink: GenerateLinkTarget | null
}

/**
 * Simplified "generate a sublink" modal — the trip/main-link is always already
 * known from context (a trip card or an open drill-in), so unlike the old
 * top-level flow, this never needs a trip picker. Shared by both trigger
 * contexts: a trip card's "Generate Link" button (`page.tsx`) and the
 * drill-in's own "+ Generate Link" button (below).
 */
export function GenerateLinkModal({ open, onClose, mainLink }: GenerateLinkModalProps) {
  const { toast } = useToast()
  const createSublink = useCreateSublink()
  const [markupAmount, setMarkupAmount] = useState('')
  const [label, setLabel] = useState('')
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  function handleClose() {
    setMarkupAmount('')
    setLabel('')
    setCreatedUrl(null)
    onClose()
  }

  async function handleGenerate() {
    if (!mainLink) return
    const amount = Number(markupAmount)
    if (!Number.isFinite(amount) || amount < 0 || amount > RESELLER_MAX_MARKUP_AMOUNT) {
      return
    }
    try {
      const sublink = await createSublink.mutateAsync({
        mainLinkToken: mainLink.token,
        markupAmount: Math.round(amount),
        label: label.trim() || undefined,
      })
      setCreatedUrl(sublinkShareUrl(sublink.tripSlug, sublink.token))
      toast({ variant: 'success', title: 'Sublink created' })
    } catch (err) {
      toast({ variant: 'error', title: (err as Error)?.message ?? 'Failed to create sublink' })
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Generate a link">
      {mainLink && !createdUrl && (
        <p className="mb-3 text-sm text-neutral-500">for &quot;{mainLink.tripTitle}&quot;</p>
      )}
      {createdUrl ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-neutral-700">Share this URL with travelers:</p>
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <code className="flex-1 truncate text-xs text-neutral-700">{createdUrl}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(createdUrl)} className="btn-ghost text-xs">
              Copy
            </button>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleClose} className="btn-primary">Done</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <NumberInput
              id="gen-markup-amount"
              label="Extra amount per traveler"
              prefix="₹"
              min={0}
              max={RESELLER_MAX_MARKUP_AMOUNT}
              value={markupAmount}
              onChange={setMarkupAmount}
              placeholder="500"
              autoFocus
            />
            <p className="mt-1 text-xs text-neutral-400">
              Charged per traveler on top of the base price. A booking of 4 travelers earns you 4× this amount.
            </p>
          </div>
          <div>
            <label htmlFor="gen-label" className="mb-1 block text-sm font-medium text-neutral-700">Label (optional)</label>
            <input
              id="gen-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Instagram campaign"
              className="input w-full text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!mainLink || createSublink.isPending}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {createSublink.isPending ? 'Creating…' : 'Generate Link'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

interface ResellerSublinksDrilldownProps {
  mainLink: ResellerMainLinkWithEarningsDto
  onClose: () => void
}

/**
 * Screen 2 of the reseller redesign — "Links for [Trip Name]" drill-in, scoped
 * to one main link's sublinks. Owns its own Generate Link modal (via
 * `GenerateLinkModal` above), bookings-view modal, and edit-rate modal — kept
 * self-contained rather than lifted into `page.tsx` since none of this state
 * is meaningful once the drill-in itself is closed.
 *
 * Both the Generate Link and Edit Markup Rate modals use the shared
 * `NumberInput` component for the ₹ amount field, which owns its own
 * min/max/NaN validation and inline error message.
 */
export function ResellerSublinksDrilldown({ mainLink, onClose }: ResellerSublinksDrilldownProps) {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const sublinks = useMySublinks({ mainLinkId: mainLink.id, page, limit })
  const patchSublink = usePatchSublink()

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingSublink, setEditingSublink] = useState<ResellerSublinkDto | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  const [bookingsSublinkId, setBookingsSublinkId] = useState<string | null>(null)
  const [bookingsPage, setBookingsPage] = useState(1)
  const bookings = useSublinkBookings(bookingsSublinkId ?? '', bookingsPage)

  async function handleCopy(id: string, url: string) {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast({ variant: 'success', title: 'Link copied' })
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
  }

  function startEdit(sublink: ResellerSublinkDto) {
    setEditingSublink(sublink)
    setEditValue(String(sublink.markupAmount))
  }

  function cancelEdit() {
    setEditingSublink(null)
    setEditValue('')
  }

  async function saveEdit(sublinkId: string) {
    const amount = Number(editValue)
    if (!Number.isFinite(amount) || amount < 0 || amount > RESELLER_MAX_MARKUP_AMOUNT) {
      return
    }
    try {
      await patchSublink.mutateAsync({ sublinkId, markupAmount: Math.round(amount) })
      toast({ variant: 'success', title: 'Markup rate updated' })
      setEditingSublink(null)
      setEditValue('')
    } catch (err) {
      toast({ variant: 'error', title: (err as Error)?.message ?? 'Failed to update markup rate' })
    }
  }

  const rows = sublinks.data?.data ?? []
  const pagination = sublinks.data?.pagination
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Links for "${mainLink.tripTitle}"`}
        className="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" /> Generate Link
            </button>
          </div>

          {sublinks.isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : sublinks.error ? (
            <ErrorState title="Failed to load links" message={sublinks.error?.message} onRetry={() => sublinks.refetch()} />
          ) : !rows.length ? (
            <EmptyState message="No links generated for this trip yet." />
          ) : (
            <div className="space-y-4">
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b-2 border-neutral-200 bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Label</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Bookings</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Earnings</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Link</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((s) => {
                      const url = sublinkShareUrl(s.tripSlug, s.token)
                      return (
                        <tr key={s.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-neutral-600">
                            <span className="max-w-[160px] truncate" title={s.label ?? undefined}>{s.label ?? '(no label)'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-neutral-700">{formatCurrency(s.markupAmount)}/person</span>
                              <button
                                type="button"
                                onClick={() => startEdit(s)}
                                className="btn-ghost inline-flex items-center px-1.5 py-1"
                                aria-label="Edit markup rate"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-neutral-700">{s.bookingCount}</td>
                          <td className="px-4 py-3 font-bold text-success-600">{formatCurrency(s.totalMarkupAmount)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="max-w-[180px] truncate font-mono text-xs text-neutral-500" title={url}>{url}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(s.id, url)}
                                className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-xs"
                              >
                                {copiedId === s.id ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedId === s.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => { setBookingsSublinkId(s.id); setBookingsPage(1) }}
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

              {pagination && totalPages > 1 && (
                <Pagination
                  currentPage={pagination.page}
                  totalPages={totalPages}
                  total={pagination.total}
                  onPageChange={setPage}
                  limit={pagination.limit}
                  onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1) }}
                />
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit markup rate modal */}
      <Modal
        open={editingSublink !== null}
        onClose={cancelEdit}
        title="Edit Markup Rate"
        footer={
          <>
            <button type="button" onClick={cancelEdit} disabled={patchSublink.isPending} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => editingSublink && saveEdit(editingSublink.id)}
              disabled={patchSublink.isPending}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {patchSublink.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div>
          <NumberInput
            id="edit-markup-amount"
            label="Rate per traveler"
            prefix="₹"
            min={0}
            max={RESELLER_MAX_MARKUP_AMOUNT}
            value={editValue}
            onChange={setEditValue}
            autoFocus
          />
          <p className="mt-1 text-xs text-neutral-400">
            This is charged on top of the base price for every traveler on a booking through this link.
          </p>
        </div>
      </Modal>

      {/* Generate link modal — reused for this drill-in's own "+ Generate Link" trigger */}
      <GenerateLinkModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        mainLink={mainLink}
      />

      {/* Bookings drill-down modal, scoped to a single sublink row */}
      <Modal open={!!bookingsSublinkId} onClose={() => setBookingsSublinkId(null)} title="Bookings via this sublink" className="max-w-4xl">
        <ResellerBookingList
          data={bookings.data?.data}
          pagination={bookings.data?.pagination}
          isLoading={bookings.isLoading}
          error={bookings.error}
          onRetry={() => bookings.refetch()}
          page={bookingsPage}
          onPageChange={setBookingsPage}
        />
      </Modal>
    </>
  )
}
