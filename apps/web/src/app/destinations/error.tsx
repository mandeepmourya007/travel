'use client'

import Link from 'next/link'
import { useLogError } from '@/hooks/use-log-error'

export default function DestinationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 flex justify-center">
      <div className="max-w-md w-full rounded-xl bg-error-50 border border-error-200 p-8 text-center">
        <p className="text-4xl mb-2">😕</p>
        <h2 className="text-base font-semibold text-neutral-800">
          Failed to load destinations
        </h2>
        <p className="mt-1 text-sm text-neutral-500">{error.message}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-outline">
            Try Again
          </button>
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
