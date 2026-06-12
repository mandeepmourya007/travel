'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMessages, useChatConnection, useSendMessage, useTypingIndicator, useMarkAsRead } from '@/hooks/use-chat'
import { useChatStore } from '@/store/chat.store'
import { useAuthStore } from '@/store/auth.store'
import { MessageBubble } from './message-bubble'
import { MessageInput } from './message-input'
import { TypingIndicator } from './typing-indicator'
import { ChatHeader } from './chat-header'
import { CONVERSATION_STATUS } from '@shared/types/chat.types'
import type { ConversationListItem } from '@shared/types/chat.types'

/** If the user is within this many px of the chat bottom, auto-scroll on new messages */
const NEAR_BOTTOM_THRESHOLD_PX = 150

interface ChatWindowProps {
  conversation: ConversationListItem | null
  onBack?: () => void
  className?: string
}

/** Message-shaped shimmer placeholders (project rule: skeletons, not spinners) */
function ChatMessagesSkeleton() {
  return (
    <div className="space-y-3 px-4 py-2" data-testid="chat-messages-skeleton">
      {[64, 40, 56, 32, 48].map((width, i) => (
        <div key={i} className={cn('flex gap-2', i % 2 === 1 && 'flex-row-reverse')}>
          <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
          <div className="skeleton h-10 rounded-2xl" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  )
}

export function ChatWindow({ conversation, onBack, className }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  const typingUsers = useChatStore((s) => s.typingUsers)
  const conversationId = conversation?.id ?? null

  useChatConnection(conversationId)
  const { sendMessage } = useSendMessage(conversationId)
  const { startTyping, stopTyping } = useTypingIndicator(conversationId)
  const { markAsRead } = useMarkAsRead(conversationId)

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(conversationId)

  const messages = data?.pages.flatMap((p) => p.data).reverse() ?? []
  const typingNames = conversationId
    ? Array.from(typingUsers.get(conversationId) ?? [])
    : []

  // Scroll anchoring: loading older pages must NOT yank the view to the bottom.
  // - prevScrollHeightRef is set right before fetching an older page; after the
  //   page renders we restore the visual position (new height - old height).
  // - Autoscroll to bottom only on first load or when a NEW newest message
  //   arrives while the user is already near the bottom.
  const prevScrollHeightRef = useRef<number | null>(null)
  const isFirstScrollRef = useRef(true)
  const newestMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const newestMessageId = newestMessage?.id ?? null
  const newestIsOwn = !!newestMessage && newestMessage.senderId === user?.id

  // Reset scroll behaviour when switching conversations
  useEffect(() => {
    isFirstScrollRef.current = true
    prevScrollHeightRef.current = null
  }, [conversationId])

  const handleLoadEarlier = () => {
    prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? null
    fetchNextPage()
  }

  // Restore anchor after an older page is prepended (before paint)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && prevScrollHeightRef.current !== null && !isFetchingNextPage) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
    }
  }, [data?.pages.length, isFetchingNextPage])

  // Autoscroll to bottom for the initial load and new incoming/sent messages.
  // Own sends always scroll (the sender must see their message land); others'
  // messages only scroll when the user is already near the bottom, so reading
  // history is never yanked away.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !newestMessageId) return
    if (prevScrollHeightRef.current !== null) return // older-page load in flight
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX
    if (isFirstScrollRef.current || nearBottom || newestIsOwn) {
      el.scrollTop = el.scrollHeight
    }
    isFirstScrollRef.current = false
  }, [newestMessageId, newestIsOwn])

  useEffect(() => {
    if (conversationId) markAsRead()
  }, [conversationId, markAsRead])

  if (!conversation) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center bg-neutral-50', className)}>
        <MessageCircle className="h-16 w-16 text-neutral-200" />
        <p className="mt-4 text-sm text-neutral-500">Select a conversation to start chatting</p>
      </div>
    )
  }

  const handleSend = (content: string) => {
    sendMessage({ content })
    stopTyping()
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col', className)}>
      <ChatHeader conversation={conversation} onBack={onBack} className="shrink-0" />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-white py-4"
      >
        {hasNextPage && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={handleLoadEarlier}
              disabled={isFetchingNextPage}
              className="text-xs text-primary-600 hover:underline disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {isLoading ? (
          <ChatMessagesSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl">😕</span>
            <p className="mt-2 text-sm font-semibold text-neutral-800">Failed to load messages</p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-primary-600 hover:underline">Try Again</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-10 w-10 text-neutral-200" />
            <p className="mt-2 text-sm text-neutral-500">No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1]
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === user?.id}
                  showAvatar={showAvatar}
                />
              )
            })}
          </div>
        )}

        <TypingIndicator names={typingNames} />
      </div>

      <MessageInput
        className="shrink-0"
        onSend={handleSend}
        onTyping={startTyping}
        onStopTyping={stopTyping}
        disabled={conversation.status === CONVERSATION_STATUS.CLOSED}
        placeholder={conversation.status === CONVERSATION_STATUS.CLOSED ? 'This conversation is closed' : undefined}
      />
    </div>
  )
}
