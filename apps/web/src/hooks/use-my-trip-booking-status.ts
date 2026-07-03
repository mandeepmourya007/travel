import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { bookingKeys } from '@/lib/query-keys'
import { useAuthStore } from '@/store/auth.store'
import type { MyTripBookingStatus } from '@shared/types/booking.types'

/**
 * Checks if the current user already has an active booking or request for a trip.
 *
 * Query key: bookingKeys.myTripStatus(tripId)
 * Only fires when authenticated — unauthenticated users always see the default CTA.
 */
export function useMyTripBookingStatus(tripId: string) {
  const hasToken = !!useAuthStore((s) => s.accessToken)

  return useQuery({
    queryKey: bookingKeys.myTripStatus(tripId),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: MyTripBookingStatus }>(
        `/bookings/my/trip-status/${tripId}`,
      )
      return res.data.data
    },
    enabled: !!tripId && hasToken,
    staleTime: STALE_TIME_REALTIME,
  })
}
