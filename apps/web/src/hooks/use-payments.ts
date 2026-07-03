import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { paymentKeys } from '@/lib/query-keys'
import { useAuthStore } from '@/store/auth.store'
import type {
  PaymentHistoryItem,
  PaymentHistoryFilters,
  AdminPaymentFilters,
  TravelerPaymentSummary,
  TripPaymentSummary,
  AdminPaymentSummary,
} from '@shared/types/payment.types'

interface PaginatedPaymentResponse {
  success: true
  data: PaymentHistoryItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ─── Traveler Hooks ──────────────────────────────────

/**
 * Fetches the current traveler's paginated payment history.
 *
 * Query key: paymentKeys.myPayments(filters) — staleTime 30s
 * Error handling: caller should render ErrorState on error
 */
export function useMyPayments(filters: PaymentHistoryFilters = {}) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: paymentKeys.myPayments(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedPaymentResponse>('/payments/my', {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetches traveler's payment summary stats.
 *
 * Query key: paymentKeys.mySummary() — staleTime 30s
 */
export function useMyPaymentSummary() {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: paymentKeys.mySummary(),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: TravelerPaymentSummary
      }>('/payments/my/summary')
      return res.data.data
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
  })
}

// ─── Organizer Hooks ─────────────────────────────────

/**
 * Fetches payments for a specific trip (organizer view).
 *
 * Query key: paymentKeys.tripPayments(tripId, filters)
 */
export function useTripPayments(tripId: string, filters: PaymentHistoryFilters = {}) {
  return useQuery({
    queryKey: paymentKeys.tripPayments(tripId, filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedPaymentResponse>(
        `/payments/trip/${tripId}`,
        { params: filters },
      )
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: !!tripId,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetches trip payment summary (revenue, commission, earnings).
 *
 * Query key: paymentKeys.tripSummary(tripId)
 */
export function useTripPaymentSummary(tripId: string) {
  return useQuery({
    queryKey: paymentKeys.tripSummary(tripId),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: TripPaymentSummary
      }>(`/payments/trip/${tripId}/summary`)
      return res.data.data
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: !!tripId,
  })
}

// ─── Admin Hooks ─────────────────────────────────────

/**
 * Fetches all payments globally (admin view).
 *
 * Query key: paymentKeys.adminPayments(filters)
 */
export function useAdminPayments(filters: AdminPaymentFilters = {}) {
  return useQuery({
    queryKey: paymentKeys.adminPayments(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedPaymentResponse>('/payments/admin', {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetches global payment summary (admin dashboard).
 *
 * Query key: paymentKeys.adminSummary()
 */
export function useAdminPaymentSummary() {
  return useQuery({
    queryKey: paymentKeys.adminSummary(),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminPaymentSummary
      }>('/payments/admin/summary')
      return res.data.data
    },
    staleTime: STALE_TIME_REALTIME,
  })
}
