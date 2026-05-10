import { create } from 'zustand'
import type { NotificationListItem } from '@shared/types/notification.types'

interface NotificationState {
  unreadCount: number
  recentNotifications: NotificationListItem[]

  setUnreadCount: (count: number) => void
  decrementUnread: (count?: number) => void
  incrementUnread: (count?: number) => void
  addNotification: (notification: NotificationListItem) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  setRecentNotifications: (items: NotificationListItem[]) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  recentNotifications: [],

  setUnreadCount: (count) => set({ unreadCount: count }),

  decrementUnread: (count = 1) =>
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - count) })),

  incrementUnread: (count = 1) =>
    set((state) => ({ unreadCount: state.unreadCount + count })),

  addNotification: (notification) =>
    set((state) => ({
      recentNotifications: [notification, ...state.recentNotifications].slice(0, 20),
      unreadCount: state.unreadCount + 1,
    })),

  markAsRead: (id) =>
    set((state) => ({
      recentNotifications: state.recentNotifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      unreadCount: 0,
      recentNotifications: state.recentNotifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
    })),

  setRecentNotifications: (items) => set({ recentNotifications: items }),
}))
