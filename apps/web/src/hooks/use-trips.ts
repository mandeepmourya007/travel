import { useQuery, keepPreviousData } from '@tanstack/react-query'
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
    placeholderData: keepPreviousData,
    staleTime: options?.staleTime ?? 0,
    initialData: options?.initialData
      ? {
          trips: options.initialData.trips,
          pagination: options.initialData.pagination ?? { page: 1, limit: 12, total: options.initialData.trips.length, totalPages: 1 },
        }
      : undefined,
    // When staleTime > 0 (e.g. useTrendingTrips: 2 min), mark SSR data as fresh so the
    // client won't immediately refetch. When staleTime is 0 (filter pages), mark data
    // as born-at-epoch so React Query treats it as stale and refetches on mount.
    initialDataUpdatedAt: options?.initialData
      ? (options?.staleTime ?? 0) > 0 ? Date.now() : 0
      : undefined,
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
