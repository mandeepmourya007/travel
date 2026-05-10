'use client'

import { useLogError } from '@/hooks/use-log-error'

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="rounded-xl border border-error-200 bg-error-50 p-8 text-center">
        <span className="text-3xl">😟</span>
        <h2 className="mt-3 font-display text-xl font-bold text-neutral-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-neutral-500">Failed to load notifications.</p>
        <button onClick={reset} className="btn-outline mt-4 text-sm">
          Try again
        </button>
      </div>
    </div>
  )
}
