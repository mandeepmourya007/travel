import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import type { TripBookingListItem, TripBookingFilters } from '@shared/types/booking.types'

interface PaginatedResponse {
  success: true
  data: TripBookingListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Fetches paginated bookings for a specific trip (organizer view).
 *
 * Query key: bookingKeys.forTrip(tripId, filters) — staleTime 15s for near-real-time feel
 * Error handling: caller should render ErrorState on error
 */
export function useTripBookings(tripId: string, filters: TripBookingFilters = {}) {
  return useQuery({
    queryKey: bookingKeys.forTrip(tripId, filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse>(`/trips/${tripId}/bookings`, {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 15_000,
    enabled: !!tripId,
  })
}
