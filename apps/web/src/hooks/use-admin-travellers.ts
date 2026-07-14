import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { adminKeys } from '@/lib/query-keys'
import type { AdminTravellerFilters, AdminTravellerListItem, AdminTravellerDetail, AdminTravellerDetailFilters } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

/**
 * Fetches the paginated admin traveller directory.
 * Query key: `adminKeys.travellers(filters)`.
 * Never invalidated by a mutation — this is a read-only admin list.
 * Errors surface via `error` for the caller to render with `ErrorState`.
 */
export function useAdminTravellers(filters: AdminTravellerFilters) {
  return useQuery({
    queryKey: adminKeys.travellers(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminTravellerListItem[]
        pagination: PaginationMeta
      }>('/admin/users/travellers', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetches a single traveller's detail: profile, booked trips, and reviews written.
 * Query key: `adminKeys.travellerDetail(id, filters)`. Disabled until `id` is truthy.
 * `filters` (page/limit/status) controls the booked-trips sub-list only; reviews are a capped list.
 * Read-only — no mutations invalidate this key.
 */
export function useAdminTravellerDetail(id: string, filters?: AdminTravellerDetailFilters) {
  return useQuery({
    queryKey: adminKeys.travellerDetail(id, filters),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: AdminTravellerDetail }>(
        `/admin/users/travellers/${id}`,
        { params: filters },
      )
      return res.data.data
    },
    enabled: !!id,
    placeholderData: (prev) => prev,
  })
}
