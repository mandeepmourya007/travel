import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { adminKeys } from '@/lib/query-keys'
import type {
  AdminOrganizerDirectoryFilters,
  AdminOrganizerDirectoryItem,
  AdminOrganizerTripsDetail,
  AdminOrganizerDetailFilters,
} from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

/**
 * Fetches the paginated admin organizer directory (name/email/businessName/trips-created).
 * Query key: `adminKeys.organizerDirectory(filters)`.
 * Read-only admin list — no mutation invalidates this key.
 */
export function useAdminOrganizerDirectory(filters: AdminOrganizerDirectoryFilters) {
  return useQuery({
    queryKey: adminKeys.organizerDirectory(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminOrganizerDirectoryItem[]
        pagination: PaginationMeta
      }>('/admin/users/organizers', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetches an organizer's summary plus the trips they created (paginated).
 * Query key: `adminKeys.organizerTripsDetail(id, filters)`. Disabled until `id` is truthy.
 * `filters` (page/limit/status) controls the trips-created sub-list only.
 * Read-only — no mutations invalidate this key.
 */
export function useAdminOrganizerTrips(id: string, filters?: AdminOrganizerDetailFilters) {
  return useQuery({
    queryKey: adminKeys.organizerTripsDetail(id, filters),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: AdminOrganizerTripsDetail }>(
        `/admin/users/organizers/${id}`,
        { params: filters },
      )
      return res.data.data
    },
    enabled: !!id,
    placeholderData: (prev) => prev,
  })
}
