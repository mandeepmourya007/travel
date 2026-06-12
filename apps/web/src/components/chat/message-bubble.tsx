'use client'

import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { MESSAGE_TYPE } from '@shared/types/chat.types'
import type { Message } from '@shared/types/chat.types'
import { Check, CheckCheck, AlertTriangle } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar?: boolean
}

export function MessageBubble({ message, isOwn, showAvatar = true }: MessageBubbleProps) {
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })

  return (
    <div className={cn('flex gap-2 px-4 py-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {showAvatar && (
        <div className="h-8 w-8 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-xs font-medium text-primary-700">
          {message.sender.name.charAt(0).toUpperCase()}
        </div>
      )}
      {!showAvatar && <div className="w-8 shrink-0" />}

      <div className={cn('max-w-[70%] space-y-1', isOwn ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm',
            isOwn
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-neutral-100 text-neutral-900 rounded-bl-md',
          )}
        >
          {message.type === MESSAGE_TYPE.SYSTEM ? (
            <p className="text-xs italic text-neutral-500">{message.content}</p>
          ) : message.type === MESSAGE_TYPE.IMAGE && message.fileUrl ? (
            // Chat images have unknown intrinsic dimensions — next/image would
            // force a fixed box, so use <img> with native lazy-loading
            <img
              src={message.fileUrl}
              alt={message.fileName ?? 'Image'}
              loading="lazy"
              decoding="async"
              className="max-w-full rounded-lg"
            />
          ) : message.type === MESSAGE_TYPE.FILE && message.fileUrl ? (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('underline', isOwn ? 'text-white' : 'text-primary-600')}
            >
              {message.fileName ?? 'Download file'}
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {message.isFlagged && (
            <div className="mt-1 flex items-center gap-1 text-xs text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              <span>Contact info hidden</span>
            </div>
          )}
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set(message.reactions.map((r) => r.emoji))).map((emoji) => {
              const count = message.reactions.filter((r) => r.emoji === emoji).length
              return (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs"
                >
                  {emoji} {count > 1 && count}
                </span>
              )
            })}
          </div>
        )}

        <div className={cn('flex items-center gap-1 text-[10px] text-neutral-400', isOwn && 'flex-row-reverse')}>
          <span>{timeAgo}</span>
          {isOwn && (
            message.readAt
              ? <CheckCheck className="h-3 w-3 text-blue-500" />
              : <Check className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  )
}
