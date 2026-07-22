'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TripSearchCombobox } from '@/components/shared/trip-search-combobox'
import { ResellerSearchCombobox } from '@/components/shared/reseller-search-combobox'
import { ResellerLeadsTable } from '@/components/reseller/reseller-leads-table'
import { ResellerBookingList } from '@/components/reseller/reseller-booking-list'
import { Modal } from '@/components/shared/modal'
import { useToast } from '@/components/shared/toast'
import { useGenerateMainLink, useOrganizerLeads, useSublinkBookings } from '@/hooks/use-reseller'
import { formatCurrency } from '@/lib/format'
import { RESELLER_LEAD_SORT } from '@shared/constants/reseller'

export default function OrganizerResellerLinksPage() {
  const { toast } = useToast()
  const [tripId, setTripId] = useState<string | undefined>(undefined)
  const [resellerId, setResellerId] = useState<string | undefined>(undefined)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteTripId, setInviteTripId] = useState<string | undefined>(undefined)
  const [resellerEmail, setResellerEmail] = useState('')
  const [bookingsSublinkId, setBookingsSublinkId] = useState<string | null>(null)
  const [bookingsPage, setBookingsPage] = useState(1)
  const [leadsPage, setLeadsPage] = useState(1)
  const [leadsLimit, setLeadsLimit] = useState(50)

  const leads = useOrganizerLeads({ tripId, resellerId, sort: RESELLER_LEAD_SORT.NEWEST, page: leadsPage, limit: leadsLimit })
  const generateMainLink = useGenerateMainLink()
  const bookings = useSublinkBookings(bookingsSublinkId ?? '', bookingsPage)

  const totalMarkupProduced = (leads.data?.data ?? []).reduce((sum, l) => sum + l.totalMarkupAmount, 0)
  const totalBookingsViaLinks = (leads.data?.data ?? []).reduce((sum, l) => sum + l.bookingCount, 0)

  async function handleInvite() {
    if (!inviteTripId || !resellerEmail.trim()) return
    try {
      await generateMainLink.mutateAsync({ tripId: inviteTripId, resellerEmail: resellerEmail.trim() })
      toast({ variant: 'success', title: 'Reseller invited' })
      setShowInviteModal(false)
      setInviteTripId(undefined)
      setResellerEmail('')
    } catch (err) {
      toast({ variant: 'error', title: (err as Error)?.message ?? 'Failed to invite reseller' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">Reseller Links</h1>
          <p className="mt-1 text-sm text-neutral-500">Invite resellers to distribute your trips and track what they earn.</p>
        </div>
        <button type="button" onClick={() => setShowInviteModal(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Invite Reseller
        </button>
      </div>

      {/* Lead summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="card-static p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Bookings via resellers</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{totalBookingsViaLinks}</p>
        </div>
        <div className="card-static p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total markup produced</p>
          <p className="mt-1 text-2xl font-bold text-success-600">{formatCurrency(totalMarkupProduced)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[200px] sm:w-64">
          <TripSearchCombobox value={tripId} onChange={setTripId} />
        </div>
        <div className="min-w-[200px] sm:w-64">
          <ResellerSearchCombobox value={resellerId} onChange={setResellerId} />
        </div>
      </div>

      {/* Per-sublink leads table */}
      <ResellerLeadsTable
        leads={leads.data?.data ?? []}
        identityColumn={null}
        isLoading={leads.isLoading}
        error={leads.error}
        onRetry={() => leads.refetch()}
        onViewBookings={(sublinkId) => { setBookingsSublinkId(sublinkId); setBookingsPage(1) }}
        pagination={leads.data?.pagination}
        onPageChange={setLeadsPage}
        onLimitChange={(newLimit) => { setLeadsLimit(newLimit); setLeadsPage(1) }}
      />

      {/* Bookings drill-down modal */}
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

      {/* Invite reseller modal */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Reseller">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Trip</label>
            <TripSearchCombobox value={inviteTripId} onChange={setInviteTripId} placeholder="Select a trip" />
          </div>
          <div>
            <label htmlFor="reseller-email" className="mb-1 block text-sm font-medium text-neutral-700">Reseller email</label>
            <input
              id="reseller-email"
              type="email"
              value={resellerEmail}
              onChange={(e) => setResellerEmail(e.target.value)}
              placeholder="reseller@example.com"
              className="input w-full text-sm"
            />
            <p className="mt-1 text-xs text-neutral-400">
              If this email belongs to a registered traveler, their account is flagged as a reseller.
              Re-inviting the same reseller for the same trip is safe — it won&apos;t create a duplicate.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setShowInviteModal(false)} className="btn-ghost">Cancel</button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={!inviteTripId || !resellerEmail.trim() || generateMainLink.isPending}
            className="btn-primary disabled:opacity-50"
          >
            {generateMainLink.isPending ? 'Inviting…' : 'Send Invite'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
