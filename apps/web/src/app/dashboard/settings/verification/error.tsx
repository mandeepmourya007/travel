'use client'

import { useLogError } from '@/hooks/use-log-error'
import { ErrorState } from '@/components/shared/data-states'

export default function VerificationDocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useLogError(error)

  return (
    <div className="mx-auto max-w-2xl py-12">
      <ErrorState
        title="Verification documents error"
        message={error.message || 'Something went wrong. Please try again.'}
        onRetry={reset}
      />
    </div>
  )
}
