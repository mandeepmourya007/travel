import { create } from 'zustand'
import type { Message } from '@shared/types/chat.types'

interface ChatState {
  activeConversationId: string | null
  onlineUsers: Set<string>
  typingUsers: Map<string, Set<string>>
  optimisticMessages: Map<string, Message[]>
  totalUnreadCount: number

  setActiveConversation: (id: string | null) => void
  setOnlineUsers: (userIds: string[]) => void
  addOnlineUser: (userId: string) => void
  removeOnlineUser: (userId: string) => void
  setTyping: (conversationId: string, userId: string) => void
  clearTyping: (conversationId: string, userId: string) => void
  addOptimisticMessage: (conversationId: string, message: Message) => void
  clearOptimisticMessages: (conversationId: string) => void
  setTotalUnreadCount: (count: number) => void
  decrementUnread: (count?: number) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  activeConversationId: null,
  onlineUsers: new Set<string>(),
  typingUsers: new Map<string, Set<string>>(),
  optimisticMessages: new Map<string, Message[]>(),
  totalUnreadCount: 0,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),

  addOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers)
      next.add(userId)
      return { onlineUsers: next }
    }),

  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers)
      next.delete(userId)
      return { onlineUsers: next }
    }),

  setTyping: (conversationId, userId) =>
    set((state) => {
      const next = new Map(state.typingUsers)
      const users = new Set(next.get(conversationId) ?? [])
      users.add(userId)
      next.set(conversationId, users)
      return { typingUsers: next }
    }),

  clearTyping: (conversationId, userId) =>
    set((state) => {
      const next = new Map(state.typingUsers)
      const users = new Set(next.get(conversationId) ?? [])
      users.delete(userId)
      if (users.size === 0) {
        next.delete(conversationId)
      } else {
        next.set(conversationId, users)
      }
      return { typingUsers: next }
    }),

  addOptimisticMessage: (conversationId, message) =>
    set((state) => {
      const next = new Map(state.optimisticMessages)
      const messages = [...(next.get(conversationId) ?? []), message]
      next.set(conversationId, messages)
      return { optimisticMessages: next }
    }),

  clearOptimisticMessages: (conversationId) =>
    set((state) => {
      const next = new Map(state.optimisticMessages)
      next.delete(conversationId)
      return { optimisticMessages: next }
    }),

  setTotalUnreadCount: (count) => set({ totalUnreadCount: count }),

  decrementUnread: (count = 1) =>
    set((state) => ({
      totalUnreadCount: Math.max(0, state.totalUnreadCount - count),
    })),
}))
