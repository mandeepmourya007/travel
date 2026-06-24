'use client'

import { useState } from 'react'
import { Mail, RefreshCw, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { useOrganizerInvites, useSendOrganizerInvite } from '@/hooks/use-admin-invites'
import type { OrganizerInviteStatus } from '@shared/types/admin.types'
import { EMAIL_REGEX } from '@shared/validators/auth.schema'

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ accepted }: { accepted: boolean }) {
  return accepted ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 border border-success-200">
      <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
      Accepted
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 border border-warning-200">
      <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
      Pending
    </span>
  )
}


export default function OrganizerInvitesPage() {
  const [statusTab, setStatusTab] = useState('all')
  const [page, setPage] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  const filters = {
    status: statusTab === 'all' ? undefined : statusTab as OrganizerInviteStatus,
    page,
    limit: 20,
  }

  const { data, isLoading, error, refetch } = useOrganizerInvites(filters)
  const sendMutation = useSendOrganizerInvite()

  const handleSend = async () => {
    setEmailError('')
    if (!EMAIL_REGEX.test(emailInput)) {
      setEmailError('Please enter a valid email address')
      return
    }
    sendMutation.mutate(emailInput, {
      onSuccess: () => {
        setShowDialog(false)
        setEmailInput('')
      },
    })
  }

  const handleResend = (email: string) => {
    sendMutation.mutate(email)
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ErrorState
          title="Failed to load organizer invites"
          message={(error as Error).message || 'Something went wrong.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">Organizer Invites</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Send invite links to onboard new organizers. Accepted when they set a password.
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
          Send Invite
        </button>
      </div>

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
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-6 py-4 last:border-b-0">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-4 w-32 ml-auto" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          message={`No ${statusTab === 'all' ? '' : statusTab + ' '}invites to display.`}
        />
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_160px_100px_100px] gap-4 border-b border-neutral-200 bg-neutral-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <span>Email</span>
              <span>Sent</span>
              <span>Sent by</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {data.data.map((invite) => (
              <div
                key={invite.id}
                className="grid grid-cols-[1fr_160px_160px_100px_100px] gap-4 border-b border-neutral-100 px-6 py-4 last:border-b-0 items-center hover:bg-neutral-50 transition-colors"
              >
                {/* Email */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="truncate text-sm font-medium text-neutral-900">{invite.email}</span>
                  </div>
                  {invite.acceptedAt && (
                    <p className="mt-0.5 pl-6 text-xs text-neutral-500">
                      Accepted {formatDate(invite.acceptedAt)}
                    </p>
                  )}
                </div>

                {/* Sent at */}
                <span className="text-sm text-neutral-600">{formatDate(invite.sentAt)}</span>

                {/* Sent by */}
                <span className="truncate text-sm text-neutral-600">
                  {invite.sentByUser?.name ?? '—'}
                </span>

                {/* Status */}
                <StatusBadge accepted={!!invite.acceptedAt} />

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                  {!invite.acceptedAt && (
                    <button
                      onClick={() => handleResend(invite.email)}
                      disabled={sendMutation.isPending}
                      title="Resend invite"
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-primary-600 hover:border-primary-300 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Resend
                    </button>
                  )}
                </div>
              </div>
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

      {/* Send invite dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Organizer Invite</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p className="mb-4 text-sm text-neutral-500">
              The recipient will receive an email with a link to create their organizer account.
              The link expires in 7 days.
            </p>
            <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Email address
            </label>
            <Input
              id="invite-email"
              type="email"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="organizer@example.com"
              autoFocus
            />
            {emailError && (
              <p className="mt-1 text-xs text-error-500">{emailError}</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => { setShowDialog(false); setEmailInput(''); setEmailError('') }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!emailInput.trim() || sendMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {sendMutation.isPending ? (
                <><span className="spinner spinner-sm" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4" /> Send Invite</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
