import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import { formatCurrency } from '@/lib/format'
import type {
  AdminPendingPayoutItem,
  AdminPendingPayoutFilters,
  AdminPayoutHistoryFilters,
  AdminPayoutHistoryItem,
  ReleasePayoutResult,
} from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

/** GET /admin/payouts/pending — paginated organizers with a positive wallet balance. */
export function useAdminPendingPayouts(filters: AdminPendingPayoutFilters) {
  return useQuery({
    queryKey: adminKeys.payoutsPending(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminPendingPayoutItem[]
        pagination: PaginationMeta
      }>('/admin/payouts/pending', {
        params: { page: filters.page, limit: filters.limit },
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
  })
}

/** GET /admin/payouts — paginated organizer wallet-ledger activity (earning/clawback/payout/reversal). */
export function useAdminPayoutHistory(filters: AdminPayoutHistoryFilters) {
  return useQuery({
    queryKey: adminKeys.payoutsHistory(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: AdminPayoutHistoryItem[]
        pagination: PaginationMeta
      }>('/admin/payouts', {
        params: {
          organizerId: filters.organizerId || undefined,
          type: filters.type || undefined,
          page: filters.page,
          limit: filters.limit,
        },
      })
      return { data: res.data.data, pagination: res.data.pagination }
    },
  })
}

interface ReleasePayoutInput {
  organizerId: string
  /** Amount in whole rupees. Omitted = release the full pending balance. */
  amount?: number
}

/**
 * Admin: triggers a real RazorpayX payout for an organizer's accrued wallet-ledger earnings.
 *
 * Invalidates: adminKeys.payoutsPending(), adminKeys.payoutsHistoryBase() (a release changes
 * both the pending balance and the wallet-activity history log).
 * Error handling: shows an error toast via onError; the caller (Send Payout modal) is
 * responsible for surfacing `insufficient_balance` inline since it needs the fresh balance.
 */
export function useAdminReleasePayout() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ organizerId, amount }: ReleasePayoutInput) => {
      const res = await apiClient.post<{ success: true; data: ReleasePayoutResult }>(
        `/admin/payouts/${organizerId}/release`,
        { amount },
      )
      return res.data.data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.payoutsPending() })
      queryClient.invalidateQueries({ queryKey: adminKeys.payoutsHistoryBase() })

      if (result.status === 'released') {
        toast({
          variant: 'success',
          title: 'Payout sent',
          description: `${formatCurrency(result.releasedAmount)} released${result.payoutId ? ` (payout ${result.payoutId})` : ''}`,
        })
      } else if (result.status === 'insufficient_balance') {
        toast({ variant: 'error', title: 'Insufficient balance', description: 'The organizer\'s pending balance has changed. Please try again.' })
      } else if (result.status === 'ledger_mismatch') {
        // 'warning', not 'error': the RazorpayX payout itself succeeded — money already left
        // for the organizer — only the wallet-ledger debit failed. Flagging it as a hard error
        // would wrongly suggest the admin should retry and risk a duplicate payout.
        toast({
          variant: 'warning',
          title: 'Payout sent, balance may be out of sync',
          description: `${formatCurrency(result.releasedAmount)} was sent to the organizer${result.payoutId ? ` (payout ${result.payoutId})` : ''}, but updating the wallet balance failed. Please check back shortly or contact support if it doesn't resolve.`,
        })
      } else {
        toast({ variant: 'error', title: 'Payout failed', description: 'The payout could not be sent. Please try again.' })
      }
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to send payout' })
    },
  })
}
