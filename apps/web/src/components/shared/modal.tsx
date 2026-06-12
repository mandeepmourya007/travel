'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { pushOverlay, popOverlay, isTopOverlay } from '@/lib/overlay-stack'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const overlayIdRef = useRef<symbol | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // A child overlay (e.g. image lightbox) is on top — it owns the keyboard
      if (overlayIdRef.current && !isTopOverlay(overlayIdRef.current)) return

      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap: keep Tab cycling inside the dialog panel (WCAG 2.1.2)
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        )
        if (focusables.length === 0) {
          e.preventDefault()
          panelRef.current.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        const inPanel = !!active && panelRef.current.contains(active)

        if (!inPanel) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose],
  )

  // Register on the overlay stack strictly per open/close — must not re-run on
  // re-renders (a re-push would hoist this modal above a child lightbox)
  useEffect(() => {
    if (!open) return
    const id = pushOverlay('modal')
    overlayIdRef.current = id
    return () => {
      popOverlay(id)
      overlayIdRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  // Initial focus on open + restore focus to the trigger on close (WCAG 2.4.3)
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? panel)?.focus()

    return () => {
      previouslyFocusedRef.current?.focus?.()
      previouslyFocusedRef.current = null
    }
  }, [open])

  if (!open) return null

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-slide-up focus:outline-none',
          className,
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-5">
            <h2 className="text-xl font-bold text-neutral-800">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-4 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
