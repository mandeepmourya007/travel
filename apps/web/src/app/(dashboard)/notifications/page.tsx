'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/use-notifications'
import { useNotificationStore } from '@/store/notification.store'
import { NOTIFICATION_TYPE_ICON } from '@/lib/notification-icons'
import { getNotificationRedirectUrl } from '@/lib/notification-redirect'
import { cn } from '@/lib/utils'
import { AuthGuard } from '@/components/shared/auth-guard'
import type { NotificationListItem, NotificationFilters } from '@shared/types/notification.types'

function NotificationRow({ item, onMarkRead }: { item: NotificationListItem; onMarkRead: (id: string) => void }) {
  const isUnread = !item.readAt
  const redirectUrl = getNotificationRedirectUrl(item.type, item.data)

  const content = (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl border p-4 transition-colors',
        isUnread
          ? 'border-primary-200 bg-primary-50/40'
          : 'border-neutral-200 bg-white',
        redirectUrl && 'hover:border-primary-300 hover:shadow-sm',
      )}
    >
      <span className="mt-0.5 text-lg">{NOTIFICATION_TYPE_ICON[item.type] ?? '🔔'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm leading-snug', isUnread ? 'font-semibold text-neutral-900' : 'text-neutral-700')}>
            {item.title}
          </p>
          {isUnread && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead(item.id) }}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-100 transition-colors"
            >
              Mark read
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-600">{item.body}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </p>
          {redirectUrl && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-primary-600">
              View <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (redirectUrl) {
    return (
      <Link
        href={redirectUrl}
        onClick={() => { if (isUnread) onMarkRead(item.id) }}
        className="block"
      >
        {content}
      </Link>
    )
  }

  return content
}

function NotificationsContent() {
  const [filters, setFilters] = useState<NotificationFilters>({ page: 1, limit: 20 })
  const [unreadOnly, setUnreadOnly] = useState(false)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const currentFilters = { ...filters, unreadOnly }
  const { data, isLoading, error, refetch } = useNotifications(currentFilters)
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="spinner spinner-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-error-200 bg-error-50 p-8 text-center">
          <span className="text-3xl">😟</span>
          <p className="mt-3 text-sm text-error-700">Failed to load notifications. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="btn-outline mt-4 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const notifications = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-neutral-500">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              unreadOnly
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            {unreadOnly ? 'Showing unread' : 'Show unread only'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Bell className="h-12 w-12 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onMarkRead={(id) => markRead.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            disabled={!pagination.page || pagination.page <= 1}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsContent />
    </AuthGuard>
  )
}
