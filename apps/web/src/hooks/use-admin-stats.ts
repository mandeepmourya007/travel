import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_DEFAULT } from '@/lib/constants'
import { adminKeys } from '@/lib/query-keys'
import type { PlatformStatsResponse } from '@shared/types/admin.types'

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: PlatformStatsResponse }>('/admin/stats')
      return res.data.data
    },
    staleTime: STALE_TIME_DEFAULT,
  })
}
