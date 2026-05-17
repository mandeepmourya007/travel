'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { OnlineIndicator } from './online-indicator'
import type { ConversationListItem } from '@shared/types/chat.types'

interface ConversationItemProps {
  conversation: ConversationListItem
  isActive: boolean
  isOnline: boolean
  onSelect: (conversationId: string) => void
}

export const ConversationItem = memo(function ConversationItem({ conversation, isActive, isOnline, onSelect }: ConversationItemProps) {
  const { otherParticipant, lastMessagePreview, lastMessageAt, unreadCount, trip } = conversation
  const displayName = otherParticipant?.name ?? 'Support'

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50',
        isActive && 'bg-primary-50 hover:bg-primary-50',
      )}
    >
      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <OnlineIndicator
          isOnline={isOnline}
          className="absolute -bottom-0.5 -right-0.5"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-medium text-neutral-900">
            {displayName}
          </p>
          {lastMessageAt && (
            <span className="shrink-0 text-[10px] text-neutral-400">
              {formatDistanceToNow(new Date(lastMessageAt), { addSuffix: false })}
            </span>
          )}
        </div>

        {trip && (
          <p className="truncate text-[11px] text-primary-600">{trip.title}</p>
        )}

        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-neutral-500">
            {lastMessagePreview ?? 'No messages yet'}
          </p>
          {unreadCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})
