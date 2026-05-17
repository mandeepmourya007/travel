'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { notificationKeys } from '@/lib/query-keys'
import { getNotificationRedirectUrl } from '@/lib/notification-redirect'
import { toast } from 'sonner'
import type { NotificationSocketPayload, NotificationListItem } from '@shared/types/notification.types'

/**
 * Global socket connection manager.
 * Connects when authenticated, disconnects on logout.
 * Listens for real-time notification:new events — updates store + shows toasts.
 * Mount once in Providers — never render more than one instance.
 */
export function SocketConnector() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const _hasHydrated = useAuthStore((s) => s._hasHydrated)
  const addNotification = useNotificationStore((s) => s.addNotification)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!_hasHydrated) return

    if (!isAuthenticated || !accessToken) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(accessToken)

    function handleNewNotification(payload: NotificationSocketPayload) {
      const item: NotificationListItem = {
        id: payload.id,
        userId: payload.userId,
        type: payload.type,
        channel: 'IN_APP',
        title: payload.title,
        body: payload.body,
        data: payload.data,
        readAt: null,
        createdAt: payload.createdAt,
      }

      addNotification(item)

      const redirectUrl = getNotificationRedirectUrl(payload.type, payload.data)
      toast(payload.title, {
        description: payload.body,
        duration: 5000,
        action: redirectUrl
          ? { label: 'View', onClick: () => router.push(redirectUrl) }
          : undefined,
      })

      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    }

    socket.on('notification:new', handleNewNotification)

    return () => {
      socket.off('notification:new', handleNewNotification)
    }
  }, [_hasHydrated, isAuthenticated, accessToken, addNotification, queryClient, router])

  return null
}
