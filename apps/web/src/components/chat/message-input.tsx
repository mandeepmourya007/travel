'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  onSend: (content: string) => void
  onTyping?: () => void
  onStopTyping?: () => void
  onFileUpload?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function MessageInput({
  onSend,
  onTyping,
  onStopTyping,
  onFileUpload,
  disabled = false,
  placeholder = 'Type a message...',
  className,
}: MessageInputProps) {
  const [value, setValue] = useState('')
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    onStopTyping?.()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (text: string) => {
    setValue(text)
    onTyping?.()

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping?.()
    }, 2000)
  }

  return (
    <div className={cn('flex items-end gap-2 border-t bg-white px-4 py-3', className)}>
      {onFileUpload && (
        <button
          type="button"
          onClick={onFileUpload}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>
      )}

      <div className="relative flex-1">
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 pr-10 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-50"
          style={{ maxHeight: '120px' }}
        />
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
          value.trim()
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-neutral-100 text-neutral-400',
        )}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}
