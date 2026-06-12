'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useConversations } from '@/hooks/use-chat'
import { ConversationSidebar } from './conversation-sidebar'
import { ChatWindow } from './chat-window'
import type { ConversationListItem } from '@shared/types/chat.types'

// Shared with the messages page skeleton so the shell dimensions can't drift.
// Full literal strings (no template composition) so Tailwind can statically detect them.
// The shell flex-fills its parent — the page owns the viewport-height math
// (it knows about its own title row); a hardcoded dvh calc here pushed the
// message input below the fold.
export const CHAT_SHELL_CLASS = 'flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-white shadow-sm'
/** Responsive sidebar width used by ChatLayout (full-width on mobile). */
export const CHAT_SIDEBAR_MD_WIDTH_CLASS = 'md:w-80'
/** Static sidebar width used by the skeleton (its sidebar only renders at md+). */
export const CHAT_SIDEBAR_WIDTH_CLASS = 'w-80'

interface ChatLayoutProps {
  className?: string
}

export function ChatLayout({ className }: ChatLayoutProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const conversationParam = searchParams.get('conversation')

  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationParam)
  const [showSidebar, setShowSidebar] = useState(!conversationParam)
  const { data } = useConversations()

  const conversations = data?.conversations ?? []
  const activeConversation: ConversationListItem | null =
    conversations.find((c) => c.id === activeConversationId) ?? null

  useEffect(() => {
    if (conversationParam) {
      setActiveConversationId(conversationParam)
      setShowSidebar(false)
      router.replace('/messages', { scroll: false })
    }
  }, [conversationParam, router])

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
    setShowSidebar(false)
  }

  const handleBack = () => {
    setShowSidebar(true)
    setActiveConversationId(null)
  }

  return (
    <div className={cn(CHAT_SHELL_CLASS, className)}>
      <div className={cn(
        'w-full md:block shrink-0',
        CHAT_SIDEBAR_MD_WIDTH_CLASS,
        !showSidebar && 'hidden md:block',
      )}>
        <ConversationSidebar
          activeConversationId={activeConversationId}
          onSelect={handleSelectConversation}
        />
      </div>

      <div className={cn(
        'min-h-0 flex-1',
        showSidebar && 'hidden md:flex',
      )}>
        <ChatWindow conversation={activeConversation} onBack={handleBack} />
      </div>
    </div>
  )
}
