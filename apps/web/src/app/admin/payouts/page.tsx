'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/shared/auth-guard'
import { OrganizerSearchCombobox } from '@/components/shared/reseller-search-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PendingPayoutsTable } from '@/components/payouts/pending-payouts-table'
import { PayoutActivityTable } from '@/components/payouts/payout-activity-table'
import { SendPayoutModal } from '@/components/payouts/send-payout-modal'
import { useAdminPendingPayouts, useAdminPayoutHistory } from '@/hooks/use-admin-payouts'
import { WALLET_TX } from '@shared/constants/wallet'
import type { AdminPayoutHistoryFilters } from '@shared/types/admin.types'
import type { AdminPendingPayoutItem } from '@shared/types/admin.types'

const TYPE_OPTIONS: { value: 'all' | AdminPayoutHistoryFilters['type']; label: string }[] = [
  { value: 'all', label: 'All Activity' },
  { value: WALLET_TX.ORGANIZER_EARNING, label: 'Earning' },
  { value: WALLET_TX.ORGANIZER_EARNING_REVERSAL, label: 'Clawback' },
  { value: WALLET_TX.ORGANIZER_PAYOUT, label: 'Payout' },
  { value: WALLET_TX.ORGANIZER_PAYOUT_REVERSED, label: 'Payout Reversed' },
]

export default function AdminPayoutsPage() {
  const [organizerId, setOrganizerId] = useState<string | undefined>(undefined)
  const [type, setType] = useState<AdminPayoutHistoryFilters['type'] | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pendingPage, setPendingPage] = useState(1)
  const [selectedOrganizer, setSelectedOrganizer] = useState<AdminPendingPayoutItem | null>(null)

  const pending = useAdminPendingPayouts({ page: pendingPage, limit: 20 })
  const history = useAdminPayoutHistory({ organizerId, type, page, limit: 20 })

  // Look up the freshest known balance for the organizer currently in the modal — after a
  // payout release invalidates the pending-payouts query, this picks up the updated balance
  // (or drops to null once it's fully paid out) without the modal needing its own fetch.
  const modalOrganizer = selectedOrganizer
    ? pending.data?.data.find((o) => o.organizerId === selectedOrganizer.organizerId) ?? selectedOrganizer
    : null

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8 space-y-8">
        <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">Organizer Payouts</h1>

        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-neutral-800">Pending Payouts</h2>
          <PendingPayoutsTable
            data={pending.data?.data}
            pagination={pending.data?.pagination}
            isLoading={pending.isLoading}
            error={pending.error}
            onRetry={() => pending.refetch()}
            onSendPayout={setSelectedOrganizer}
            page={pendingPage}
            onPageChange={setPendingPage}
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-neutral-800">Organizer Wallet Activity</h2>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="w-full sm:w-64">
              <OrganizerSearchCombobox
                value={organizerId}
                onChange={(id) => { setOrganizerId(id); setPage(1) }}
              />
            </div>
            <Select
              value={type ?? 'all'}
              onValueChange={(v) => {
                setType(v === 'all' ? undefined : (v as AdminPayoutHistoryFilters['type']))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value as string}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <PayoutActivityTable
            data={history.data?.data}
            pagination={history.data?.pagination}
            isLoading={history.isLoading}
            error={history.error}
            onRetry={() => history.refetch()}
            page={page}
            onPageChange={setPage}
          />
        </section>
      </div>

      <SendPayoutModal
        open={!!selectedOrganizer}
        onClose={() => setSelectedOrganizer(null)}
        organizer={modalOrganizer}
      />
    </AuthGuard>
  )
}
