import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { walletKeys } from '@/lib/query-keys'
import type { WalletSummary, WalletTransactionItem, WalletTransactionFilters } from '@shared/types/wallet.types'

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
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: WalletSummary }>('/wallet')
      return res.data.data
    },
    staleTime: 30_000,
  })
}

/**
 * Fetches paginated wallet transaction history for the current user.
 *
 * Query key: walletKeys.transactions(filters) — staleTime 30s
 * Error handling: caller should render ErrorState on error
 */
export function useWalletTransactions(filters: WalletTransactionFilters = {}) {
  return useQuery({
    queryKey: walletKeys.transactions(filters),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedWalletTxResponse>('/wallet/transactions', {
        params: filters,
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
