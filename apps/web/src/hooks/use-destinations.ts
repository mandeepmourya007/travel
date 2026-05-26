import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { destinationKeys } from '@/lib/query-keys'
import type { Destination } from '@shared/types/destination.types'

export function useDestinations() {
  return useQuery({
    queryKey: destinationKeys.list(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: Destination[] }>('/destinations')
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
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
