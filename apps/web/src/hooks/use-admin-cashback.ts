import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import type {
  CompletedTripForCashback,
  CashbackTravelerItem,
  IssueCashbackDto,
  IssueCashbackResponse,
  CashbackHistoryByUser,
  CashbackHistoryByTrip,
  CashbackUserTripDetail,
  CashbackTripFilters,
  CashbackHistoryFilters,
} from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

export function useCompletedTripsForCashback(filters: CashbackTripFilters) {
  return useQuery({
    queryKey: adminKeys.cashbackTrips(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: CompletedTripForCashback[]
        pagination: PaginationMeta
      }>('/admin/cashback/trips', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useCashbackTripDetail(tripId: string) {
  return useQuery({
    queryKey: adminKeys.cashbackTripDetail(tripId),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: CashbackTravelerItem[]
      }>(`/admin/cashback/trips/${tripId}`)
      return res.data.data
    },
    enabled: !!tripId,
    staleTime: 30_000,
  })
}

export function useIssueCashback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dto: IssueCashbackDto) => {
      const res = await apiClient.post<{
        success: true
        data: IssueCashbackResponse
      }>('/admin/cashback/issue', dto)
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.cashbackTripDetail(variables.tripId) })
      queryClient.invalidateQueries({ queryKey: adminKeys.cashbackTripsBase() })
      queryClient.invalidateQueries({ queryKey: adminKeys.cashbackByUserBase() })
      queryClient.invalidateQueries({ queryKey: adminKeys.cashbackByTripBase() })
    },
  })
}

export function useCashbackByUser(filters: CashbackHistoryFilters) {
  return useQuery({
    queryKey: adminKeys.cashbackByUser(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: CashbackHistoryByUser[]
        pagination: PaginationMeta
      }>('/admin/cashback/by-user', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useCashbackByTrip(filters: CashbackHistoryFilters) {
  return useQuery({
    queryKey: adminKeys.cashbackByTrip(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: CashbackHistoryByTrip[]
        pagination: PaginationMeta
      }>('/admin/cashback/by-trip', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useCashbackUserDetail(userId: string, filters: CashbackHistoryFilters) {
  return useQuery({
    queryKey: adminKeys.cashbackUserDetail(userId, filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: CashbackUserTripDetail[]
        pagination: PaginationMeta
      }>(`/admin/cashback/by-user/${userId}`, { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    enabled: !!userId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
