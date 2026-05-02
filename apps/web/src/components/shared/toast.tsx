'use client'

import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'warning' | 'error' | 'info'

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number
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

const VARIANT_ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

const DEFAULT_DURATION = 4000

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = VARIANT_ICONS[toast.variant]
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const duration = toast.duration ?? DEFAULT_DURATION
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timerRef.current)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 text-sm leading-relaxed shadow-lg animate-slide-up',
        VARIANT_STYLES[toast.variant],
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 opacity-80">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
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

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-full max-w-sm"
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
