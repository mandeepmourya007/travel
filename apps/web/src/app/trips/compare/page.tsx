'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useCompareTrips } from '@/hooks/use-compare-trips'
import { TripComparisonTable } from '@/components/trips/trip-comparison-table'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { cn } from '@/lib/utils'

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const slugsParam = searchParams.get('trips') || ''
  const slugs = slugsParam.split(',').filter(Boolean).slice(0, 3)

  const { trips, isLoading, error } = useCompareTrips(slugs)

  function handleRemove(slug: string) {
    const remaining = slugs.filter((s) => s !== slug)
    if (remaining.length < 2) {
      router.push('/trips')
    } else {
      router.replace(`/trips/compare?trips=${remaining.join(',')}`)
    }
  }

  if (slugs.length < 2) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <EmptyState
          message="Select at least 2 trips to compare. Head back to the listing to pick trips."
          action={
            <Link href="/trips" className="btn-primary text-sm">
              Browse Trips
            </Link>
          }
        />
      </div>
    )
  }

  if (isLoading) {
    return <ComparisonSkeleton count={slugs.length} />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ErrorState
          title="Failed to load trip details"
          onRetry={() => router.refresh()}
        />
      </div>
    )
  }

  if (trips.length < 2) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ErrorState
          title="Could not load enough trips"
          message="One or more trips may no longer be available."
          onRetry={() => router.refresh()}
        />
      </div>
    )
  }

  const bestPrice = Math.min(...trips.map((t) => t.pricePerPerson))
  const bestRating = Math.max(...trips.map((t) => t.organizer.rating))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors mb-1 sm:mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to trips
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-neutral-800">
            Comparing {trips.length} Trips
          </h1>
        </div>
      </div>

      {/* Insight badges */}
      <div className="mb-4 sm:mb-6 flex flex-wrap gap-2 sm:gap-3">
        {trips.length >= 2 && (
          <>
            <InsightBadge
              label="Best Value"
              value={trips.find((t) => t.pricePerPerson === bestPrice)?.title || ''}
              variant="success"
            />
            <InsightBadge
              label="Best Rated"
              value={trips.find((t) => t.organizer.rating === bestRating)?.title || ''}
              variant="primary"
            />
          </>
        )}
      </div>

      {/* Comparison Table */}
      <TripComparisonTable trips={trips} onRemove={handleRemove} />
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<ComparisonSkeleton count={3} />}>
      <CompareContent />
    </Suspense>
  )
}

// ── Sub-components ──────────────────────────────────

function InsightBadge({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: 'success' | 'primary'
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5',
        variant === 'success' ? 'bg-success-50 border-neutral-200' : 'bg-primary-50 border-primary-200',
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold',
          variant === 'success' ? 'text-success-500' : 'text-primary-600',
        )}
      >
        {label}:
      </span>
      <span className="text-xs font-medium text-neutral-700 max-w-48 truncate">
        {value}
      </span>
    </div>
  )
}

function ComparisonSkeleton({ count }: { count: number }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="skeleton h-5 w-24 mb-2" />
      <div className="skeleton h-7 sm:h-8 w-48 sm:w-56 mb-6" />
      <div className="flex gap-3 mb-6">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-8 w-40" />
      </div>

      {/* Product header skeleton — side-by-side cards */}
      <div
        className="grid gap-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col items-center space-y-2">
            <div className="skeleton aspect-square w-full max-w-36 sm:max-w-44 rounded-lg" />
            <div className="skeleton h-3 sm:h-4 w-3/4" />
            <div className="skeleton h-4 sm:h-5 w-1/2" />
            <div className="skeleton h-2.5 w-2/3" />
          </div>
        ))}
      </div>

      {/* Table rows skeleton */}
      <div className="mt-6 space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton h-8 w-full rounded-none" />
            <div
              className="grid gap-0"
              style={{ gridTemplateColumns: `auto repeat(${count}, 1fr)` }}
            >
              <div className="skeleton h-10 w-16 sm:w-24 rounded-none" />
              {Array.from({ length: count }).map((_, j) => (
                <div key={j} className="skeleton h-10 w-full rounded-none" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
