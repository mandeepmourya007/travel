import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { organizerKeys } from '@/lib/query-keys'
import type { OrganizerStats } from '@shared/types/trip.types'

/**
 * Fetches aggregated dashboard statistics for the logged-in organizer.
 *
 * Query key: organizerKeys.stats() — staleTime 30s to avoid excessive refetches
 * Error handling: caller should render ErrorState on error
 */
export function useOrganizerStats() {
  return useQuery({
    queryKey: organizerKeys.stats(),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerStats
      }>('/trips/organizer/stats')
      return res.data.data
    },
    staleTime: 30_000,
  })
}
