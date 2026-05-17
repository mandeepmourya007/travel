import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_DEFAULT } from '@/lib/constants'
import { tripRequestKeys } from '@/lib/query-keys'
import type { PendingRequestWithTrip } from '@shared/types/trip-request.types'

/**
 * Fetches all pending trip requests across organizer's trips.
 * Query key: tripRequestKeys.allPending()
 * Error handling: caller should render ErrorState on error
 */
export function useAllPendingRequests() {
  return useQuery({
    queryKey: tripRequestKeys.allPending(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: PendingRequestWithTrip[] }>(
        '/trips/organizer/pending-requests',
      )
      return res.data.data
    },
    staleTime: STALE_TIME_DEFAULT,
  })
}
