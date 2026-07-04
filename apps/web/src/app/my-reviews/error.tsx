'use client'

import { ErrorState } from '@/components/shared/data-states'

export default function MyReviewsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ErrorState title="Couldn't load your reviews" onRetry={reset} />
    </div>
  )
}
