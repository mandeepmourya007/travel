'use client'

import { useState } from 'react'
import { AdminTripSearchCombobox } from '@/components/shared/trip-search-combobox'
import { ResellerSearchCombobox, OrganizerSearchCombobox } from '@/components/shared/reseller-search-combobox'
import { Modal } from '@/components/shared/modal'
import { ResellerLeadsTable } from '@/components/reseller/reseller-leads-table'
import { ResellerBookingList } from '@/components/reseller/reseller-booking-list'
import { useAdminLeads, useSublinkBookings } from '@/hooks/use-reseller'
import { formatCurrency } from '@/lib/format'
import { RESELLER_LEAD_SORT } from '@shared/constants/reseller'

export default function AdminResellerLinksPage() {
  const [tripId, setTripId] = useState<string | undefined>(undefined)
  const [organizerId, setOrganizerId] = useState<string | undefined>(undefined)
  const [resellerId, setResellerId] = useState<string | undefined>(undefined)
  const [bookingsSublinkId, setBookingsSublinkId] = useState<string | null>(null)
  const [bookingsPage, setBookingsPage] = useState(1)
  const [leadsPage, setLeadsPage] = useState(1)
  const [leadsLimit, setLeadsLimit] = useState(50)

  const leads = useAdminLeads({ tripId, resellerId, organizerId, sort: RESELLER_LEAD_SORT.MARKUP_DESC, page: leadsPage, limit: leadsLimit })
  const bookings = useSublinkBookings(bookingsSublinkId ?? '', bookingsPage)

  const totalMarkup = (leads.data?.data ?? []).reduce((sum, l) => sum + l.totalMarkupAmount, 0)
  const totalBookings = (leads.data?.data ?? []).reduce((sum, l) => sum + l.bookingCount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">Reseller Links</h1>
        <p className="mt-1 text-sm text-neutral-500">All reseller sublinks and leads, platform-wide.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="card-static p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Bookings via resellers</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{totalBookings}</p>
        </div>
        <div className="card-static p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total markup, platform-wide</p>
          <p className="mt-1 text-2xl font-bold text-success-600">{formatCurrency(totalMarkup)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[200px] sm:w-56">
          <AdminTripSearchCombobox value={tripId} onChange={setTripId} />
        </div>
        <div className="min-w-[200px] sm:w-56">
          <OrganizerSearchCombobox value={organizerId} onChange={setOrganizerId} />
        </div>
        <div className="min-w-[200px] sm:w-56">
          <ResellerSearchCombobox value={resellerId} onChange={setResellerId} />
        </div>
      </div>

      <ResellerLeadsTable
        leads={leads.data?.data ?? []}
        identityColumn="reseller"
        isLoading={leads.isLoading}
        error={leads.error}
        onRetry={() => leads.refetch()}
        onViewBookings={(sublinkId) => { setBookingsSublinkId(sublinkId); setBookingsPage(1) }}
        pagination={leads.data?.pagination}
        onPageChange={setLeadsPage}
        onLimitChange={(newLimit) => { setLeadsLimit(newLimit); setLeadsPage(1) }}
      />

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
    </div>
  )
}
