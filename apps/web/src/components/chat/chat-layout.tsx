'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { useConversations } from '@/hooks/use-chat'
import { ConversationSidebar } from './conversation-sidebar'
import { ChatWindow } from './chat-window'
import type { ConversationListItem } from '@shared/types/chat.types'

interface ChatLayoutProps {
  className?: string
}

export function ChatLayout({ className }: ChatLayoutProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const conversationParam = searchParams.get('conversation')

  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationParam)
  const [showSidebar, setShowSidebar] = useState(!conversationParam)
  const accessToken = useAuthStore((s) => s.accessToken)
  const { data } = useConversations()

  const conversations = data?.conversations ?? []
  const activeConversation: ConversationListItem | null =
    conversations.find((c) => c.id === activeConversationId) ?? null

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken)
    }
    return () => {
      disconnectSocket()
    }
  }, [accessToken])

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
    <div className={cn('flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border bg-white shadow-sm', className)}>
      <div className={cn(
        'w-full md:w-80 md:block shrink-0',
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
