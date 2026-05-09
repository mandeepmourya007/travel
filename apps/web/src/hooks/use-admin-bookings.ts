import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import type { AdminBookingItem, AdminBookingDetail, AdminBookingFilters } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

export function useAdminBookings(filters: AdminBookingFilters) {
  return useQuery({
    queryKey: adminKeys.bookings(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminBookingItem[]
        pagination: PaginationMeta
      }>('/admin/bookings', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useAdminBookingDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.bookingDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: AdminBookingDetail }>(
        `/admin/bookings/${id}`,
      )
      return res.data.data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}
