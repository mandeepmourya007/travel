'use client'

import { useLogError } from '@/hooks/use-log-error'

import { ErrorState } from '@/components/shared/data-states'

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 flex justify-center">
      <ErrorState
        title="Booking failed"
        message={error.message || 'Something went wrong. Please try again.'}
        onRetry={reset}
      />
    </div>
  )
}
