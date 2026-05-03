import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import type { MyBookingListItem, MyBookingFilters } from '@shared/types/booking.types'

interface PaginatedResponse {
  success: true
  data: MyBookingListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Fetches the current traveler's paginated booking list.
 *
 * Query key: bookingKeys.myBookings(filters) — staleTime 15s
 * Error handling: caller should render ErrorState on error
 */
export function useMyBookings(filters: MyBookingFilters = {}, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.myBookings(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse>('/bookings/my', {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    enabled,
  })
}
