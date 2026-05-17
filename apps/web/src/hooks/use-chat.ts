import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useCallback, useRef, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_DEFAULT, STALE_TIME_REALTIME, REFETCH_INTERVAL_REALTIME } from '@/lib/constants'
import { chatKeys } from '@/lib/query-keys'
import { getSocket } from '@/lib/socket'
import { useChatStore } from '@/store/chat.store'
import { useAuthStore } from '@/store/auth.store'
import type {
  Conversation,
  ConversationListItem,
  Message,
  ConversationListFilters,
  SendMessageDto,
} from '@shared/types/chat.types'

// ─── Read Hooks ─────────────────────────────────────

/**
 * Fetches paginated conversation list for the current user.
 */
export function useConversations(filters?: ConversationListFilters) {
  return useQuery({
    queryKey: chatKeys.conversationList(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: ConversationListItem[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>('/chat/conversations', { params: filters })
      return { conversations: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
  })
}

/**
 * Fetches messages for a conversation with cursor-based infinite scroll.
 */
export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId ?? ''),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: 50 }
      if (pageParam) params.cursor = pageParam
      const res = await apiClient.get<{
        success: true
        data: Message[]
        hasMore: boolean
        nextCursor: string | null
      }>(`/chat/conversations/${conversationId}/messages`, { params })
      return res.data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!conversationId,
  })
}

/**
 * Search messages in a conversation.
 */
export function useSearchMessages(conversationId: string | null, query: string) {
  return useQuery({
    queryKey: chatKeys.messageSearch(conversationId ?? '', query),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: Message[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>(`/chat/conversations/${conversationId}/messages/search`, { params: { query } })
      return { messages: res.data.data, pagination: res.data.pagination }
    },
    enabled: !!conversationId && query.length >= 2,
    staleTime: 10_000,
  })
}

/**
 * Fetches total unread count for the header badge.
 */
export function useUnreadCount() {
  const setTotalUnreadCount = useChatStore((s) => s.setTotalUnreadCount)

  return useQuery({
    queryKey: chatKeys.unreadCount(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: { totalUnread: number } }>('/chat/unread-count')
      setTotalUnreadCount(res.data.data.totalUnread)
      return res.data.data
    },
    refetchInterval: REFETCH_INTERVAL_REALTIME,
    staleTime: STALE_TIME_DEFAULT,
  })
}

// ─── Write Hooks ────────────────────────────────────

/**
 * Get or create a trip conversation.
 */
export function useCreateTripConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.post<{ success: true; data: Conversation }>(
        `/chat/conversations/trip/${tripId}`,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
    },
  })
}

/**
 * Get or create a support conversation.
 */
export function useCreateSupportConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: true; data: Conversation }>(
        '/chat/conversations/support',
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
    },
  })
}

/**
 * Send a message via REST (fallback when socket fails).
 */
export function useSendMessageRest(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dto: SendMessageDto) => {
      const res = await apiClient.post<{ success: true; data: Message }>(
        `/chat/conversations/${conversationId}/messages`,
        dto,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
      queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() })
    },
  })
}

/**
 * Add a reaction to a message.
 */
export function useAddReaction(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await apiClient.post<{ success: true; data: Message }>(
        `/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji },
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
    },
  })
}

/**
 * Remove a reaction from a message.
 */
export function useRemoveReaction(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await apiClient.delete<{ success: true; data: Message }>(
        `/chat/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
    },
  })
}

// ─── Socket Hooks ───────────────────────────────────

/**
 * Manages socket connection for a conversation room.
 * Joins/leaves room, handles incoming events.
 */
export function useChatConnection(conversationId: string | null) {
  const queryClient = useQueryClient()
  const setTyping = useChatStore((s) => s.setTyping)
  const clearTyping = useChatStore((s) => s.clearTyping)
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    if (!conversationId) return

    const socket = getSocket()
    if (!socket) return

    socket.emit('chat:join', { conversationId })

    const handleMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
      }
    }

    const handleTyping = ({ conversationId: convId, userId, userName }: { conversationId: string; userId: string; userName?: string }) => {
      if (convId === conversationId) {
        const displayKey = userName || userId
        setTyping(convId, displayKey)

        const existing = typingTimeoutRef.current.get(displayKey)
        if (existing) clearTimeout(existing)

        const timeout = setTimeout(() => {
          clearTyping(convId, displayKey)
          typingTimeoutRef.current.delete(displayKey)
        }, 3000)
        typingTimeoutRef.current.set(displayKey, timeout)
      }
    }

    const handleStopTyping = ({ conversationId: convId, userId, userName }: { conversationId: string; userId: string; userName?: string }) => {
      if (convId === conversationId) {
        const displayKey = userName || userId
        clearTyping(convId, displayKey)
        const existing = typingTimeoutRef.current.get(displayKey)
        if (existing) {
          clearTimeout(existing)
          typingTimeoutRef.current.delete(displayKey)
        }
      }
    }

    const handleReadReceipt = () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
    }

    const handleReactionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
    }

    socket.on('chat:message', handleMessage)
    socket.on('chat:typing-indicator', handleTyping)
    socket.on('chat:stop-typing-indicator', handleStopTyping)
    socket.on('chat:read-receipt', handleReadReceipt)
    socket.on('chat:reaction-update', handleReactionUpdate)

    return () => {
      socket.emit('chat:leave', { conversationId })
      socket.off('chat:message', handleMessage)
      socket.off('chat:typing-indicator', handleTyping)
      socket.off('chat:stop-typing-indicator', handleStopTyping)
      socket.off('chat:read-receipt', handleReadReceipt)
      socket.off('chat:reaction-update', handleReactionUpdate)

      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout))
      typingTimeoutRef.current.clear()
    }
  }, [conversationId, queryClient, setTyping, clearTyping])
}

/**
 * Send a message via socket (preferred) with REST fallback.
 */
export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient()

  const sendMessage = useCallback(
    async (dto: SendMessageDto) => {
      if (!conversationId) return

      const socket = getSocket()
      if (socket?.connected) {
        socket.emit('chat:send', { conversationId, ...dto })
      } else {
        await apiClient.post(`/chat/conversations/${conversationId}/messages`, dto)
      }

      queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) })
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
    },
    [conversationId, queryClient],
  )

  return { sendMessage }
}

/**
 * Emit typing/stop-typing indicators.
 */
export function useTypingIndicator(conversationId: string | null) {
  const typingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userName = useAuthStore((s) => s.user?.name)

  const startTyping = useCallback(() => {
    if (!conversationId || typingRef.current) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('chat:typing', { conversationId, userName })
      typingRef.current = true

      timeoutRef.current = setTimeout(() => {
        typingRef.current = false
      }, 2000)
    }
  }, [conversationId, userName])

  const stopTyping = useCallback(() => {
    if (!conversationId || !typingRef.current) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('chat:stop-typing', { conversationId, userName })
    }
    typingRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [conversationId, userName])

  return { startTyping, stopTyping }
}

/**
 * Mark messages as read via socket.
 */
export function useMarkAsRead(conversationId: string | null) {
  const queryClient = useQueryClient()
  const decrementUnread = useChatStore((s) => s.decrementUnread)

  const markAsRead = useCallback(() => {
    if (!conversationId) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('chat:read', { conversationId })
      decrementUnread()
      queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() })
    }
  }, [conversationId, queryClient, decrementUnread])

  return { markAsRead }
}

/**
 * Hook for presence checking.
 */
export function usePresence(userIds: string[]) {
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const addOnlineUser = useChatStore((s) => s.addOnlineUser)
  const removeOnlineUser = useChatStore((s) => s.removeOnlineUser)
  const setOnlineUsers = useChatStore((s) => s.setOnlineUsers)
  const stableIds = useMemo(() => userIds, [userIds.join(',')])

  useEffect(() => {
    const socket = getSocket()
    if (!socket || stableIds.length === 0) return

    socket.emit('presence:check', { userIds: stableIds })

    const handleStatus = ({ online }: { online: string[] }) => {
      setOnlineUsers(online)
    }

    const handleOnline = ({ userId }: { userId: string }) => {
      if (stableIds.includes(userId)) addOnlineUser(userId)
    }

    const handleOffline = ({ userId }: { userId: string }) => {
      removeOnlineUser(userId)
    }

    socket.on('presence:status', handleStatus)
    socket.on('presence:online', handleOnline)
    socket.on('presence:offline', handleOffline)

    return () => {
      socket.off('presence:status', handleStatus)
      socket.off('presence:online', handleOnline)
      socket.off('presence:offline', handleOffline)
    }
  }, [stableIds, addOnlineUser, removeOnlineUser, setOnlineUsers])

  const isOnline = useCallback((userId: string) => onlineUsers.has(userId), [onlineUsers])

  return { onlineUsers, isOnline }
}
