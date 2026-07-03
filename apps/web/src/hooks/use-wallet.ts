import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { walletKeys } from '@/lib/query-keys'
import { useAuthStore } from '@/store/auth.store'
import type { WalletSummary, WalletTransactionItem, WalletTransactionFilters } from '@shared/types/wallet.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

interface PaginatedWalletTxResponse {
  success: true
  data: WalletTransactionItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Fetches the current user's wallet balance and summary.
 *
 * Query key: walletKeys.balance() — staleTime 30s
 * Error handling: caller should render ErrorState on error
 */
export function useWalletBalance() {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: WalletSummary }>('/wallet')
      return res.data.data
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
  })
}

/**
 * Fetches paginated wallet transaction history for the current user.
 *
 * Query key: walletKeys.transactions(filters) — staleTime 30s
 * Error handling: caller should render ErrorState on error
 */
export function useWalletTransactions(filters: WalletTransactionFilters = {}) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: walletKeys.transactions(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedWalletTxResponse>('/wallet/transactions', {
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
 * Fetches the current user's cashback transactions with trip names.
 *
 * Query key: walletKeys.cashback(page) — staleTime 30s
 * Uses enriched endpoint that resolves booking→trip for tripName.
 */
export function useWalletCashback(page = 1) {
  const hasToken = !!useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: walletKeys.cashback(page),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: WalletTransactionItem[]
        pagination: PaginationMeta
      }>('/wallet/cashback', { params: { page, limit: 10 } })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    enabled: hasToken,
    placeholderData: (prev) => prev,
  })
}
