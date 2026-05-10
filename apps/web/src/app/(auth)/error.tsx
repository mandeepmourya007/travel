'use client'

import { useLogError } from '@/hooks/use-log-error'

import { ErrorState } from '@/components/shared/data-states'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12">
      <ErrorState
        title="Authentication error"
        message="Something went wrong. Please try again."
        onRetry={reset}
      />
    </div>
  )
}
