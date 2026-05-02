import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import type { TripBookingSummary } from '@shared/types/booking.types'

/**
 * Fetches aggregated booking summary stats for a trip's stats bar.
 *
 * Query key: bookingKeys.tripSummary(tripId) — staleTime 15s
 * Error handling: caller should render ErrorState on error
 */
export function useTripSummary(tripId: string) {
  return useQuery({
    queryKey: bookingKeys.tripSummary(tripId),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: TripBookingSummary
      }>(`/trips/${tripId}/summary`)
      return res.data.data
    },
    staleTime: 15_000,
    enabled: !!tripId,
  })
}
