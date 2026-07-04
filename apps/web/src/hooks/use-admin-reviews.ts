import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import type { AdminReviewFilters, AdminReviewItem } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

/**
 * Admin — platform-wide paginated review list.
 * Query key: adminKeys.reviews(filters) — staleTime: realtime
 * Supports: organizer text search, trip text search, rating filter, sortBy + sortOrder.
 */
export function useAdminReviews(filters: AdminReviewFilters) {
  return useQuery({
    queryKey: adminKeys.reviews(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminReviewItem[]
        pagination: PaginationMeta
      }>('/admin/reviews', {
        params: {
          organizerSearch: filters.organizerSearch || undefined,
          tripId: filters.tripId || undefined,
          rating: filters.rating,
          sortBy: filters.sortBy || undefined,
          sortOrder: filters.sortOrder || undefined,
          page: filters.page,
          limit: filters.limit,
        },
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}
