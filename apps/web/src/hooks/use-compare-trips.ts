import { useQueries } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import type { TripDetail } from '@shared/types/trip.types'

/**
 * Fetch multiple trip details in parallel for comparison.
 * Uses useQueries — one query per slug, each independently cached.
 */
export function useCompareTrips(slugs: string[]) {
  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: tripKeys.detail(slug),
      queryFn: async () => {
        const res = await apiClient.get<{ success: true; data: TripDetail }>(
          `/trips/slug/${slug}`,
        )
        return res.data.data
      },
      enabled: !!slug,
    })),
  })

  const isLoading = results.some((r) => r.isLoading)
  const error = results.find((r) => r.error)?.error ?? null
  const trips = results.map((r) => r.data).filter(Boolean) as TripDetail[]

  return { trips, isLoading, error, results }
}
