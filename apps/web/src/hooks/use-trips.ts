import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import type { TripSummary, TripFilters } from '@shared/types/trip.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

export function useTrips(filters: TripFilters) {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: TripSummary[]
        pagination: PaginationMeta
      }>('/trips', { params: filters })
      return {
        trips: res.data.data,
        pagination: res.data.pagination,
      }
    },
    placeholderData: (prev) => prev,
  })
}

export function useTrendingTrips() {
  const filters: TripFilters = { sort: 'popularity', limit: 6 }
  return useTrips(filters)
}
