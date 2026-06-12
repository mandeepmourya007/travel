'use client'

import { createContext, useContext, useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

type ToastVariant = 'success' | 'warning' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number
  /** Optional action button (e.g. "View" on a notification toast) */
  action?: ToastAction
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-success-50 text-success-500 border-success-200',
  warning: 'bg-warning-50 text-warning-500 border-warning-200',
  error: 'bg-error-50 text-error-500 border-error-200',
  info: 'bg-info-50 text-info-500 border-info-200',
}

const DEFAULT_DURATION = 4000
const TIMER_RADIUS = 14
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const duration = toast.duration ?? DEFAULT_DURATION
  const [progress, setProgress] = useState(100)
  const [exiting, setExiting] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const startTime = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)

      if (remaining === 0) {
        clearInterval(intervalRef.current)
        dismissWithAnimation()
      }
    }, 50)

    return () => clearInterval(intervalRef.current)
  }, [toast.id, duration])

  function dismissWithAnimation() {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }

  function handleManualDismiss() {
    clearInterval(intervalRef.current)
    dismissWithAnimation()
  }

  const dashOffset = TIMER_CIRCUMFERENCE * (1 - progress / 100)
  const remainingSeconds = Math.ceil((progress / 100) * (duration / 1000))

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 text-sm leading-relaxed shadow-lg will-change-transform',
        exiting ? 'animate-toast-exit' : 'animate-slide-up',
        VARIANT_STYLES[toast.variant],
      )}
    >
      {/* Circular timer */}
      <div className="relative flex-shrink-0">
        <svg
          className="-rotate-90"
          width="32"
          height="32"
          viewBox="0 0 32 32"
        >
          <circle
            cx="16"
            cy="16"
            r={TIMER_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-30"
          />
          <circle
            cx="16"
            cy="16"
            r={TIMER_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={TIMER_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold">{remainingSeconds}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 opacity-80">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              handleManualDismiss()
            }}
            className="mt-2 rounded-md bg-white/60 px-3 py-1 text-xs font-semibold shadow-sm transition-colors hover:bg-white"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={handleManualDismiss}
        className="flex-shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev, { ...opts, id }])
  }, [])

  // Stable context value — consumers (providers, hooks) shouldn't re-render
  // every time a toast is added or removed
  const contextValue = useMemo<ToastContextValue>(
    () => ({ toast: addToast, dismiss }),
    [addToast, dismiss],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container — fixed, mobile-first responsive */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex flex-col gap-3 sm:w-[380px] sm:max-w-sm"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>')
  }
  return ctx
}
