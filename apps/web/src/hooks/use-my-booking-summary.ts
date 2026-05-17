import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_DEFAULT } from '@/lib/constants'
import { bookingKeys } from '@/lib/query-keys'
import type { MyBookingSummary } from '@shared/types/booking.types'

/**
 * Fetches tab count badges for the current traveler's bookings.
 *
 * Query key: bookingKeys.mySummary() — staleTime 15s
 * Error handling: caller should render ErrorState on error
 */
export function useMyBookingSummary() {
  return useQuery({
    queryKey: bookingKeys.mySummary(),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: MyBookingSummary
      }>('/bookings/my/summary')
      return res.data.data
    },
    staleTime: STALE_TIME_DEFAULT,
  })
}
