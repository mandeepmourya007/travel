'use client'

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCreateTripConversation } from '@/hooks/use-chat'
import { useAuthStore } from '@/store/auth.store'

interface ChatWithOrganizerButtonProps {
  tripId: string
  className?: string
}

export function ChatWithOrganizerButton({ tripId, className }: ChatWithOrganizerButtonProps) {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userRole = useAuthStore((s) => s.user?.role)
  const { mutate: createConversation, isPending } = useCreateTripConversation()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted || userRole === 'ORGANIZER') return null

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push(`/login/email?returnTo=/trips`)
      return
    }

    createConversation(tripId, {
      onSuccess: (conversation) => {
        router.push(`/messages?conversation=${conversation.id}`)
      },
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'fixed bottom-44 right-4 z-40 flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl disabled:opacity-70 md:bottom-6 md:right-6',
        className,
      )}
    >
      <MessageCircle className="h-5 w-5" />
      {isPending ? 'Opening...' : 'Chat with Organizer'}
    </button>
  )
}
