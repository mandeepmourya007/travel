'use client'

import { useState, useCallback, memo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotificationStore } from '@/store/notification.store'
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from '@/hooks/use-notifications'
import { NOTIFICATION_TYPE_ICON } from '@/lib/notification-icons'
import { getNotificationRedirectUrl } from '@/lib/notification-redirect'
import { cn } from '@/lib/utils'
import type { NotificationListItem } from '@shared/types/notification.types'

interface NotificationItemProps {
  item: NotificationListItem
  onMarkRead: (id: string) => void
  onNavigate: (url: string) => void
}

const NotificationItem = memo(function NotificationItem({ item, onMarkRead, onNavigate }: NotificationItemProps) {
  const isUnread = !item.readAt
  const redirectUrl = getNotificationRedirectUrl(item.type, item.data)

  const handleClick = () => {
    if (isUnread) onMarkRead(item.id)
    if (redirectUrl) onNavigate(redirectUrl)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50',
        isUnread && 'bg-primary-50/50',
        redirectUrl && 'cursor-pointer',
      )}
    >
      <span className="mt-0.5 text-base leading-none">{NOTIFICATION_TYPE_ICON[item.type] ?? '🔔'}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', isUnread ? 'font-semibold text-neutral-900' : 'text-neutral-700')}>
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{item.body}</p>
        <p className="mt-1 text-xs text-neutral-400">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>
      <div className="mt-1.5 flex flex-shrink-0 items-center gap-1">
        {redirectUrl && <ExternalLink className="h-3 w-3 text-neutral-400" />}
        {isUnread && <span className="h-2 w-2 rounded-full bg-primary-500" />}
      </div>
    </button>
  )
})

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const recentNotifications = useNotificationStore((s) => s.recentNotifications)
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const handleMarkRead = useCallback((id: string) => markRead.mutate(id), [markRead])
  const handleNavigate = useCallback((url: string) => {
    setOpen(false)
    router.push(url)
  }, [router])

  // Fetch recent notifications for the dropdown (syncs page 1 to store)
  useNotifications({ page: 1, limit: 5 })
  // Fetch unread count (polls every 30s)
  useUnreadCount(true)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 sm:w-96">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
          {recentNotifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto h-8 w-8 text-neutral-300" />
              <p className="mt-2 text-sm text-neutral-500">No notifications yet</p>
            </div>
          ) : (
            recentNotifications.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                onMarkRead={handleMarkRead}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {recentNotifications.length > 0 && (
          <div className="border-t border-neutral-100 px-4 py-2.5">
            <Link
              href="/notifications"
              prefetch={false}
              className="block text-center text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              View all notifications
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
