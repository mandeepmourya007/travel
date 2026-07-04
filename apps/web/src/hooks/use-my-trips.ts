import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { tripKeys } from '@/lib/query-keys'
import type { OrganizerTripListItem } from '@shared/types/trip.types'

export interface TripSearchItem {
  id: string
  title: string
  slug: string
  status: string
  destination: { name: string }
}

interface TripSearchResponse {
  success: true
  data: TripSearchItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Searchable + paginated trip list for combobox search.
 * Query key: tripKeys.myTripsSearch(q, page, limit) — staleTime 30s
 */
export function useMyTripsSearch(q: string, page: number, limit = 10) {
  return useQuery({
    queryKey: tripKeys.myTripsSearch(q, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<TripSearchResponse>('/trips/my/search', {
        params: { q: q || undefined, page, limit },
      })
      return res.data
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetches the logged-in organizer's trip list, optionally filtered by status.
 * Query key: tripKeys.myTrips(status) — staleTime 30s
 */
export function useMyTrips(status?: string) {
  return useQuery({
    queryKey: tripKeys.myTrips(status),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerTripListItem[]
      }>('/trips/my/list', { params: status ? { status } : {} })
      return res.data.data
    },
    staleTime: STALE_TIME_REALTIME,
  })
}
