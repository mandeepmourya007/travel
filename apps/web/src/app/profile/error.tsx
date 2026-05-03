'use client'

import { ErrorState } from '@/components/shared/data-states'

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <ErrorState
        title="Failed to load profile"
        message={error.message}
        onRetry={reset}
      />
    </div>
  )
}
