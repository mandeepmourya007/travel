'use client'

import { ErrorState } from '@/components/shared/data-states'

export default function OrganizerDocReviewError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <ErrorState
        title="Failed to load document review"
        message={error.message || 'Something went wrong.'}
        onRetry={reset}
      />
    </div>
  )
}
