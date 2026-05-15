'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { ChatLayout } from '@/components/chat'
import { useUnreadCount } from '@/hooks/use-chat'
import { AuthGuard } from '@/components/shared/auth-guard'

function ChatPageContent() {
  const router = useRouter()
  useUnreadCount()

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-3">
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

export default function MessagesPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>}>
        <ChatPageContent />
      </Suspense>
    </AuthGuard>
  )
}
