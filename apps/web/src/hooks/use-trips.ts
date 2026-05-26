import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import type { TripSummary, TripFilters } from '@shared/types/trip.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

interface UseTripsOptions {
  initialData?: { trips: TripSummary[]; pagination: PaginationMeta | null }
  staleTime?: number
}

export function useTrips(filters: TripFilters, options?: UseTripsOptions) {
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
    ...(options?.initialData && { initialData: options.initialData }),
    ...(options?.staleTime !== undefined && { staleTime: options.staleTime }),
  })
}

export function useTrendingTrips(
  initialData?: { trips: TripSummary[]; pagination: PaginationMeta | null },
) {
  const filters: TripFilters = { sort: 'popularity', limit: 6 }
  return useTrips(filters, {
    staleTime: 2 * 60 * 1000,
    ...(initialData && { initialData }),
  })
}
