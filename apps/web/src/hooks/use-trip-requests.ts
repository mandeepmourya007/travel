import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripRequestKeys } from '@/lib/query-keys'
import type { TripRequestListItem, TripRequestFilters } from '@shared/types/trip-request.types'

interface PaginatedResponse {
  success: true
  data: TripRequestListItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Fetches paginated trip requests for a specific trip (organizer view).
 *
 * Query key: tripRequestKeys.forTrip(tripId, filters) — staleTime 15s for near-real-time feel
 * Error handling: caller should render ErrorState on error
 */
export function useTripRequests(tripId: string, filters: TripRequestFilters = {}) {
  return useQuery({
    queryKey: tripRequestKeys.forTrip(tripId, filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse>(`/trips/${tripId}/requests`, {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 15_000,
    enabled: !!tripId,
  })
}
