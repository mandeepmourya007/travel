'use client'

import { useState } from 'react'
import { Gift } from 'lucide-react'
import { AuthGuard } from '@/components/shared/auth-guard'
import { EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { useProfile } from '@/hooks/use-profile'
import { useMyMainLinksAsReseller } from '@/hooks/use-reseller'
import { ResellerTripCard, ResellerTripCardSkeleton } from '@/components/reseller/reseller-trip-card'
import { ResellerSublinksDrilldown, GenerateLinkModal } from '@/components/reseller/reseller-sublinks-drilldown'
import { formatCurrency } from '@/lib/format'
import { TRAVELER_ROLES } from '@shared/constants/roles'
import type { ResellerMainLinkWithEarningsDto } from '@shared/types/reseller.types'

export default function ResellerHomePage() {
  return (
    <AuthGuard allowedRoles={[...TRAVELER_ROLES]}>
      <ResellerHomeContent />
    </AuthGuard>
  )
}

function ResellerHomeContent() {
  const profile = useProfile()
  const isReseller = !!profile.data?.isReseller

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const mainLinks = useMyMainLinksAsReseller({ page, limit })

  const [drilldownMainLink, setDrilldownMainLink] = useState<ResellerMainLinkWithEarningsDto | null>(null)
  const [generateLinkTarget, setGenerateLinkTarget] = useState<ResellerMainLinkWithEarningsDto | null>(null)

  if (profile.isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-8"><div className="skeleton h-40" /></div>
  }

  if (!isReseller) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <EmptyState
          icon={<Gift className="mx-auto h-12 w-12 text-neutral-300" />}
          message="You're not registered as a reseller yet. Ask an organizer to generate a trip link naming your account — once they share it, the trip will show up here."
        />
      </div>
    )
  }

  const rows = mainLinks.data?.data ?? []
  const pagination = mainLinks.data?.pagination
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1

  const totalBookings = rows.reduce((sum, m) => sum + m.bookingCount, 0)
  const totalMarkup = rows.reduce((sum, m) => sum + m.totalMarkupAmount, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8">
      <div>
        <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">Reseller Links</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Trips shared with you — view your links or create a new one.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card-static p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Bookings</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{totalBookings}</p>
        </div>
        <div className="card-static p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total markup earned</p>
          <p className="mt-1 text-2xl font-bold text-success-600">{formatCurrency(totalMarkup)}</p>
        </div>
      </div>

      {mainLinks.isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <ResellerTripCardSkeleton key={i} />)}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<Gift className="mx-auto h-12 w-12 text-neutral-300" />}
          message="No trips have been shared with you yet. Once an organizer names you as a reseller on a trip, it'll show up here."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((mainLink) => (
            <ResellerTripCard
              key={mainLink.id}
              mainLink={mainLink}
              onViewLinks={setDrilldownMainLink}
              onGenerateLink={setGenerateLinkTarget}
            />
          ))}

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

      {/* Generate-link modal triggered directly from a trip card (no drill-in open) */}
      <GenerateLinkModal
        open={!!generateLinkTarget}
        onClose={() => setGenerateLinkTarget(null)}
        mainLink={generateLinkTarget}
      />

      {/* Screen 2 — links drill-in for a single trip's main link */}
      {drilldownMainLink && (
        <ResellerSublinksDrilldown
          mainLink={drilldownMainLink}
          onClose={() => setDrilldownMainLink(null)}
        />
      )}
    </div>
  )
}
