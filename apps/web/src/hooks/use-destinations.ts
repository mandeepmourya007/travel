import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { destinationKeys } from '@/lib/query-keys'
import type { Destination } from '@shared/types/destination.types'

export function useDestinations(initialData?: Destination[]) {
  return useQuery({
    queryKey: destinationKeys.list(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: Destination[] }>('/destinations')
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
    // Only seed from SSR when it actually has data — otherwise a stale/empty
    // build-time snapshot would be treated as fresh and block the client refetch.
    ...(initialData && initialData.length > 0 && { initialData }),
  })
}

export function usePopularDestinations(initialData?: Destination[]) {
  return useQuery({
    queryKey: destinationKeys.popular(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: Destination[] }>('/destinations', {
        params: { popular: 'true' },
      })
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
    ...(initialData && { initialData }),
  })
}
