'use client'

import { useEffect, useRef } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'
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

interface ChatWindowProps {
  conversation: ConversationListItem | null
  onBack?: () => void
  className?: string
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

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

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
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs text-primary-600 hover:underline disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
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
