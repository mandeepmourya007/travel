'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useOrganizerApprovals, useApproveRejectOrganizer } from '@/hooks/use-admin-organizers'
import { OrganizerApprovalCard } from '@/components/admin/organizer-approval-card'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import type { VerificationStatusFilter } from '@shared/types/admin.types'

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export default function OrganizerApprovalsPage() {
  const [statusTab, setStatusTab] = useState('PENDING')
  const [page, setPage] = useState(1)

  const filters = {
    status: statusTab === 'all' ? undefined : statusTab as VerificationStatusFilter,
    page,
    limit: 20,
  }

  const { data, isLoading, error, refetch } = useOrganizerApprovals(filters)
  const mutation = useApproveRejectOrganizer()

  const handleApprove = (id: string) => {
    mutation.mutate({ id, action: 'APPROVED' })
  }

  const handleReject = (id: string, reason?: string) => {
    mutation.mutate({ id, action: 'REJECTED', reason })
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load organizer approvals"
          message={error.message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-neutral-900">Organizer Approvals</h1>

      <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(1) }}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-static p-6">
              <div className="flex gap-4">
                <div className="skeleton h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-5 w-48" />
                  <div className="skeleton h-4 w-64" />
                  <div className="skeleton h-4 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          message={`No ${statusTab === 'all' ? '' : statusTab.toLowerCase() + ' '}organizer profiles to display.`}
        />
      ) : (
        <>
          <div className="space-y-4">
            {data.data.map((org) => (
              <OrganizerApprovalCard
                key={org.id}
                organizer={org}
                onApprove={handleApprove}
                onReject={handleReject}
                isPending={mutation.isPending}
              />
            ))}
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Previous
              </Button>
              <span className="text-sm text-neutral-500">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
