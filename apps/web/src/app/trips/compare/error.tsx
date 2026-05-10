'use client'

import { useLogError } from '@/hooks/use-log-error'

export default function CompareError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="text-5xl">😵</div>
      <h2 className="text-2xl font-display font-bold text-neutral-900">
        Comparison failed
      </h2>
      <p className="text-neutral-600 text-center max-w-md">
        We couldn&apos;t load the trip comparison. This is probably temporary.
      </p>
      <button onClick={reset} className="btn-primary">
        Try Again
      </button>
    </div>
  )
}
