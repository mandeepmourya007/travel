'use client'

import { ErrorState } from '@/components/shared/data-states'

export default function AdminReviewsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-10">
      <ErrorState title="Couldn't load reviews" onRetry={reset} />
    </div>
  )
}
