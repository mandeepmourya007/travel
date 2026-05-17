import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_DEFAULT, STALE_TIME_REALTIME, REFETCH_INTERVAL_REALTIME } from '@/lib/constants'
import { notificationKeys } from '@/lib/query-keys'
import { useNotificationStore } from '@/store/notification.store'
import type { NotificationListItem, NotificationFilters, NotificationUnreadCountResponse } from '@shared/types/notification.types'
import type { PaginationMeta } from '@shared/types/api-response.types'
import { useEffect } from 'react'

interface PaginatedNotificationResponse {
  success: true
  data: NotificationListItem[]
  pagination: PaginationMeta
}

/**
 * Fetches paginated notifications for the current user.
 * Syncs the first page to the store for the dropdown.
 */
export function useNotifications(filters: NotificationFilters = {}) {
  const setRecentNotifications = useNotificationStore((s) => s.setRecentNotifications)

  const query = useQuery({
    queryKey: notificationKeys.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedNotificationResponse>('/notifications', {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })

  // Sync first page to store for dropdown
  useEffect(() => {
    if (query.data?.data && (!filters.page || filters.page === 1)) {
      setRecentNotifications(query.data.data)
    }
  }, [query.data, filters.page, setRecentNotifications])

  return query
}

/**
 * Fetches unread notification count and syncs to store.
 * Polls every 30 seconds.
 */
export function useUnreadCount(enabled = true) {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)

  const query = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: NotificationUnreadCountResponse }>('/notifications/unread-count')
      return res.data.data.count
    },
    enabled,
    staleTime: STALE_TIME_DEFAULT,
    refetchInterval: REFETCH_INTERVAL_REALTIME,
  })

  useEffect(() => {
    if (typeof query.data === 'number') {
      setUnreadCount(query.data)
    }
  }, [query.data, setUnreadCount])

  return query
}

/**
 * Marks a single notification as read.
 * Optimistically updates store, invalidates queries on success.
 */
export function useMarkRead() {
  const queryClient = useQueryClient()
  const store = useNotificationStore

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.patch(`/notifications/${notificationId}/read`)
    },
    onMutate: (notificationId) => {
      const prev = {
        recent: store.getState().recentNotifications,
        count: store.getState().unreadCount,
      }
      store.getState().markAsRead(notificationId)
      store.getState().decrementUnread(1)
      return prev
    },
    onError: (_err, _id, context) => {
      if (context) {
        store.getState().setRecentNotifications(context.recent)
        store.getState().setUnreadCount(context.count)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

/**
 * Marks all notifications as read.
 * Optimistically updates store, invalidates queries on success.
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  const store = useNotificationStore

  return useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all')
    },
    onMutate: () => {
      const prev = {
        recent: store.getState().recentNotifications,
        count: store.getState().unreadCount,
      }
      store.getState().markAllAsRead()
      return prev
    },
    onError: (_err, _vars, context) => {
      if (context) {
        store.getState().setRecentNotifications(context.recent)
        store.getState().setUnreadCount(context.count)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
