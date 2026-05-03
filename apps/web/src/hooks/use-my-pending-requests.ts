import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import type { MyTripRequestItem } from '@shared/types/trip-request.types'

/**
 * Fetches approved trip requests awaiting payment (Payment Pending tab).
 *
 * GET /bookings/my/pending-requests
 * Query key: bookingKeys.myBookings({ tab: 'payment_pending' })
 * Only enabled when the Payment Pending tab is active (C3 fix)
 */
export function useMyPendingRequests(enabled = true) {
  return useQuery({
    queryKey: bookingKeys.myBookings({ tab: 'payment_pending' }),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: MyTripRequestItem[] }>(
        '/bookings/my/pending-requests',
      )
      return res.data.data
    },
    staleTime: 15_000,
    enabled,
  })
}
