'use client'

import { ErrorState } from '@/components/shared/data-states'

export default function AdminTripTypesError({ reset }: { reset: () => void }) {
  return (
    <div className="py-12">
      <ErrorState
        title="Failed to load Trip Types"
        onRetry={reset}
      />
    </div>
  )
}
