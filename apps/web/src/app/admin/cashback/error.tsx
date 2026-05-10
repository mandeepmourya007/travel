'use client'

import { useLogError } from '@/hooks/use-log-error'

import { ErrorState } from '@/components/shared/data-states'

export default function AdminCashbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <ErrorState
        title="Cashback page error"
        message={error.message || 'Something went wrong. Please try again.'}
        onRetry={reset}
      />
    </div>
  )
}
