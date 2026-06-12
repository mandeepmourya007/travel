'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChatLayout } from '@/components/chat'
import { CHAT_SHELL_CLASS, CHAT_SIDEBAR_WIDTH_CLASS } from '@/components/chat/chat-layout'
import { useUnreadCount } from '@/hooks/use-chat'
import { AuthGuard } from '@/components/shared/auth-guard'

// The page owns the viewport height (4rem app header) so title row + chat
// shell + input always fit on screen with zero page scroll. dvh, not vh:
// mobile URL bars shrink the visual viewport and would hide the input.
const PAGE_SHELL_CLASS =
  'mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8'

function ChatPageContent() {
  const router = useRouter()
  useUnreadCount()

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-neutral-800">Messages</h1>
      </div>
      <ChatLayout />
    </div>
  )
}

function MessagesPageSkeleton() {
  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <div className="skeleton h-8 w-8 rounded-full" />
        <div className="skeleton h-7 w-32" />
      </div>
      <div className={CHAT_SHELL_CLASS}>
        <div className={`hidden ${CHAT_SIDEBAR_WIDTH_CLASS} shrink-0 space-y-3 border-r p-4 md:block`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="skeleton h-full w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<MessagesPageSkeleton />}>
        <ChatPageContent />
      </Suspense>
    </AuthGuard>
  )
}
