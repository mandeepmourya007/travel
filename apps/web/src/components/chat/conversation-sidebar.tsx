'use client'

import { useState } from 'react'
import { Search, MessageCircle, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConversations } from '@/hooks/use-chat'
import { useChatStore } from '@/store/chat.store'
import { ConversationItem } from './conversation-item'
import { CONVERSATION_TYPE } from '@shared/types/chat.types'
import type { ConversationType } from '@shared/types/chat.types'

interface ConversationSidebarProps {
  activeConversationId: string | null
  onSelect: (conversationId: string) => void
  className?: string
}

export function ConversationSidebar({ activeConversationId, onSelect, className }: ConversationSidebarProps) {
  const [activeTab, setActiveTab] = useState<ConversationType | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const { onlineUsers } = useChatStore()

  const { data, isLoading, error, refetch } = useConversations(
    activeTab ? { type: activeTab } : undefined,
  )

  const conversations = data?.conversations ?? []
  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.otherParticipant?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.trip?.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations

  return (
    <div className={cn('flex h-full flex-col border-r bg-white', className)}>
      <div className="border-b px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-neutral-900">Messages</h2>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="input py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab(undefined)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            !activeTab ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(CONVERSATION_TYPE.TRIP_CHAT)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            activeTab === CONVERSATION_TYPE.TRIP_CHAT ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Trips
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(CONVERSATION_TYPE.ADMIN_SUPPORT)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            activeTab === CONVERSATION_TYPE.ADMIN_SUPPORT ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          <Headphones className="h-3.5 w-3.5" />
          Support
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-3">
                <div className="h-10 w-10 shrink-0 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded skeleton" />
                  <div className="h-2.5 w-36 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <span className="text-4xl">😕</span>
            <p className="mt-2 text-sm font-semibold text-neutral-800">Failed to load</p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-primary-600 hover:underline">Try Again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <MessageCircle className="h-10 w-10 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No conversations yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                isOnline={conv.otherParticipant ? onlineUsers.has(conv.otherParticipant.id) : false}
                onClick={() => onSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
