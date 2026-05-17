import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { tripKeys } from '@/lib/query-keys'
import type { OrganizerTripListItem } from '@shared/types/trip.types'

/**
 * Fetches the logged-in organizer's trip list, optionally filtered by status.
 *
 * Query key: tripKeys.myTrips(status) — staleTime 30s
 * Error handling: caller should render ErrorState on error
 */
export function useMyTrips(status?: string) {
  return useQuery({
    queryKey: tripKeys.myTrips(status),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerTripListItem[]
      }>('/trips/my/list', { params: status ? { status } : {} })
      return res.data.data
    },
    staleTime: STALE_TIME_REALTIME,
  })
}
