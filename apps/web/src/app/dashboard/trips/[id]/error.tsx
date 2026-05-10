'use client'

import { useLogError } from '@/hooks/use-log-error'

import { ErrorState } from '@/components/shared/data-states'

export default function TripDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <ErrorState
        title="Failed to load trip details"
        message={error.message || 'Something went wrong. Please try again.'}
        onRetry={reset}
      />
    </div>
  )
}
