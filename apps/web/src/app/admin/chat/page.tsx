'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useFlaggedMessages } from '@/hooks/use-admin-chat'
import { Pagination } from '@/components/shared/pagination'

export default function AdminFlaggedMessagesPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useFlaggedMessages(page)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-neutral-900">Flagged Messages</h1>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full skeleton" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded skeleton" />
                  <div className="h-2.5 w-64 rounded skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-neutral-900">Flagged Messages</h1>
        <div className="mt-6 flex flex-col items-center rounded-lg border border-error-200 bg-error-50 p-8">
          <AlertTriangle className="h-8 w-8 text-error-500" />
          <p className="mt-2 text-sm text-error-500">Failed to load flagged messages</p>
        </div>
      </div>
    )
  }

  const messages = data?.messages ?? []
  const pagination = data?.pagination

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">Flagged Messages</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Messages flagged for contact info leakage ({pagination?.total ?? 0} total)
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <AlertTriangle className="h-10 w-10 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-500">No flagged messages</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-800">
                    {msg.sender.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">{msg.sender.name}</span>
                      <span className="text-[10px] text-neutral-400">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{msg.content}</p>
                    {msg.originalContent && (
                      <div className="mt-2 rounded bg-white p-2 text-xs text-neutral-500">
                        <span className="font-medium text-amber-700">Original:</span>{' '}
                        {msg.originalContent}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    Flagged
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
