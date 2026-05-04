'use client'

import { ErrorState } from '@/components/shared/data-states'

export default function AdminPaymentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <ErrorState
        title="Payment dashboard error"
        message={error.message || 'Something went wrong. Please try again.'}
        onRetry={reset}
      />
    </div>
  )
}
