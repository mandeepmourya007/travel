import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { resellerKeys } from '@/lib/query-keys'
import type { ResellerSearchResultItem, OrganizerSearchResultItem } from '@shared/types/reseller.types'

interface SearchResponse<T> {
  success: true
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Searchable + paginated reseller list for combobox search.
 * Organizer: scoped to resellers already linked to the organizer's own main links.
 * Admin: all resellers on the platform.
 * Query key: resellerKeys.resellerSearch(q, page, limit) — staleTime 30s
 */
export function useResellerSearch(q: string, page: number, limit = 10) {
  return useQuery({
    queryKey: resellerKeys.resellerSearch(q, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<SearchResponse<ResellerSearchResultItem>>('/reseller/resellers/search', {
        params: { q: q || undefined, page, limit },
      })
      return res.data
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

/**
 * Searchable + paginated organizer list for combobox search. Admin only.
 * Query key: resellerKeys.organizerSearch(q, page, limit) — staleTime 30s
 */
export function useOrganizerSearch(q: string, page: number, limit = 10) {
  return useQuery({
    queryKey: resellerKeys.organizerSearch(q, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<SearchResponse<OrganizerSearchResultItem>>('/reseller/organizers/search', {
        params: { q: q || undefined, page, limit },
      })
      return res.data
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}
