'use client'

import { useState } from 'react'
import { Building2, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { useDebounce } from '@/hooks/use-debounce'
import { useOrganizerLeads, useUpdateOrganizerLeadStatus } from '@/hooks/use-organizer-lead'
import { ORGANIZER_LEAD_STATUSES } from '@shared/constants/organizer-lead'
import type { OrganizerLeadStatus } from '@shared/constants/organizer-lead'

const STATUS_TABS: Array<{ value: 'all' | OrganizerLeadStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'REJECTED', label: 'Rejected' },
]

const STATUS_BADGE: Record<OrganizerLeadStatus, string> = {
  NEW: 'bg-primary-50 text-primary-700 border-primary-200',
  CONTACTED: 'bg-warning-50 text-warning-700 border-warning-200',
  CONVERTED: 'bg-success-50 text-success-700 border-success-200',
  REJECTED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function OrganizerLeadsPage() {
  const [statusTab, setStatusTab] = useState<'all' | OrganizerLeadStatus>('all')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)
  const [page, setPage] = useState(1)

  const filters = {
    status: statusTab === 'all' ? undefined : statusTab,
    search: search.trim() || undefined,
    page,
    limit: 20,
  }

  const { data, isLoading, error, refetch } = useOrganizerLeads(filters)
  const updateStatus = useUpdateOrganizerLeadStatus()

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load organizer leads"
          message={(error as Error).message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Organizer Leads</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Waitlist submissions from the &ldquo;List your trips&rdquo; CTA on the home page.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={statusTab}
          onValueChange={(v) => {
            setStatusTab(v as 'all' | OrganizerLeadStatus)
            setPage(1)
          }}
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="md:w-72">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name, email, business…"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="skeleton h-4 w-48" />
              <div className="mt-3 skeleton h-3 w-64" />
              <div className="mt-2 skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          message={
            statusTab === 'all'
              ? 'No organizer leads yet. Submissions from the home page will appear here.'
              : `No ${statusTab.toLowerCase()} leads to display.`
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block">
            <div className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_140px_120px] gap-4 border-b border-neutral-200 bg-neutral-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <span>Name</span>
              <span>Contact</span>
              <span>Business</span>
              <span>City</span>
              <span>Submitted</span>
              <span>Status</span>
            </div>

            {data.data.map((lead) => (
              <div
                key={lead.id}
                className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_140px_120px] items-center gap-4 border-b border-neutral-100 px-6 py-4 last:border-b-0 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{lead.fullName}</p>
                  {lead.notes && (
                    <p className="mt-0.5 truncate text-xs text-neutral-500" title={lead.notes}>
                      {lead.notes}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-1.5 truncate text-sm text-neutral-700">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="truncate">{lead.email}</span>
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    <Phone className="h-3 w-3 shrink-0 text-neutral-400" />
                    {lead.phone}
                  </p>
                </div>
                <span className="truncate text-sm text-neutral-700">{lead.businessName || '—'}</span>
                <span className="truncate text-sm text-neutral-700">{lead.city || '—'}</span>
                <span className="text-xs text-neutral-500">{formatDate(lead.createdAt)}</span>
                <StatusSelect
                  value={lead.status}
                  disabled={updateStatus.isPending}
                  onChange={(status) => updateStatus.mutate({ id: lead.id, status })}
                />
              </div>
            ))}
          </div>

          {/* Mobile stacked cards */}
          <div className="space-y-3 md:hidden">
            {data.data.map((lead) => (
              <article
                key={lead.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                      <UserRound className="h-4 w-4 text-neutral-400" />
                      {lead.fullName}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-700">
                      <Mail className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{lead.email}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-700">
                      <Phone className="h-3.5 w-3.5 text-neutral-400" />
                      {lead.phone}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[lead.status]}`}
                  >
                    {lead.status}
                  </span>
                </div>

                {(lead.businessName || lead.city) && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                    {lead.businessName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-neutral-400" /> {lead.businessName}
                      </span>
                    )}
                    {lead.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-neutral-400" /> {lead.city}
                      </span>
                    )}
                  </div>
                )}

                {lead.notes && (
                  <p className="mt-2 text-xs text-neutral-500">{lead.notes}</p>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                  <span className="text-xs text-neutral-400">{formatDate(lead.createdAt)}</span>
                  <StatusSelect
                    value={lead.status}
                    disabled={updateStatus.isPending}
                    onChange={(status) => updateStatus.mutate({ id: lead.id, status })}
                  />
                </div>
              </article>
            ))}
          </div>

          {(data.pagination?.totalPages ?? 0) > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface StatusSelectProps {
  value: OrganizerLeadStatus
  disabled: boolean
  onChange: (status: OrganizerLeadStatus) => void
}

function StatusSelect({ value, disabled, onChange }: StatusSelectProps) {
  return (
    <select
      aria-label="Lead status"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as OrganizerLeadStatus)}
      className={`w-full min-w-[120px] cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 ${STATUS_BADGE[value]}`}
    >
      {ORGANIZER_LEAD_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-neutral-800">
          {s.charAt(0) + s.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  )
}
