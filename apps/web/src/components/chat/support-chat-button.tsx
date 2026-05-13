'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateSupportConversation } from '@/hooks/use-chat'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'

interface SupportChatButtonProps {
  className?: string
}

export function SupportChatButton({ className }: SupportChatButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const router = useRouter()
  const { mutate: createSupport, isPending } = useCreateSupportConversation()

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push('/login/email?returnTo=/messages')
      return
    }

    createSupport(undefined, {
      onSuccess: (conversation) => {
        router.push(`/messages?conversation=${conversation.id}`)
      },
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isPending}
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl disabled:opacity-70',
        !isHovered && 'px-3',
        className,
      )}
      aria-label="Need help? Start a support conversation"
    >
      <MessageCircle className="h-5 w-5" />
      {isHovered && <span className="text-sm font-medium">Need Help?</span>}
    </button>
  )
}
