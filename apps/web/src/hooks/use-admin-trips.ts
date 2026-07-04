import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import type { AdminTripFilters } from '@shared/types/admin.types'
import type { OrganizerTripListItem } from '@shared/types/trip.types'

interface AdminTripsResponse {
  success: true
  data: OrganizerTripListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function useAdminTrips(filters: AdminTripFilters) {
  return useQuery({
    queryKey: adminKeys.trips(filters),
    queryFn: async () => {
      const res = await apiClient.get<AdminTripsResponse>('/admin/trips', {
        params: {
          q: filters.q || undefined,
          status: filters.status || undefined,
          sortBy: filters.sortBy || undefined,
          sortOrder: filters.sortOrder || undefined,
          page: filters.page,
          limit: filters.limit,
        },
      })
      return res.data
    },
    staleTime: 30_000,
  })
}
