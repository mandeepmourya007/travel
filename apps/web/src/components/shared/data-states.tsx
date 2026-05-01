'use client'

import { SearchX } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Failed to load',
  message = 'This is probably temporary. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-error-50 border border-red-200 p-8 text-center">
      <p className="text-4xl mb-2">😕</p>
      <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-outline mt-4"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  message?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({
  message = 'Nothing to show here yet.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="card-static mx-auto max-w-md p-12 text-center">
      {icon ?? <SearchX className="mx-auto h-12 w-12 text-neutral-300" />}
      <p className="mt-3 text-sm text-neutral-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
