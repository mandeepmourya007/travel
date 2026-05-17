'use client'

import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OnlineIndicator } from './online-indicator'
import { useChatStore } from '@/store/chat.store'
import type { ConversationListItem } from '@shared/types/chat.types'

interface ChatHeaderProps {
  conversation: ConversationListItem
  onBack?: () => void
  className?: string
}

export function ChatHeader({ conversation, onBack, className }: ChatHeaderProps) {
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const participant = conversation.otherParticipant
  const displayName = participant?.name ?? 'Support'
  const isOnline = participant ? onlineUsers.has(participant.id) : false

  return (
    <div className={cn('flex items-center gap-3 border-b bg-white px-4 py-3', className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="relative">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <OnlineIndicator isOnline={isOnline} className="absolute -bottom-0.5 -right-0.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">
          {displayName}
        </p>
        <p className="text-xs text-neutral-500">
          {conversation.trip ? conversation.trip.title : 'Support'}
          {isOnline && <span className="ml-1 text-success-500">Online</span>}
        </p>
      </div>
    </div>
  )
}
