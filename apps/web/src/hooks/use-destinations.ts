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
  })
}

export function usePopularDestinations() {
  const query = useDestinations()
  const popular = query.data?.filter((d) => d.isPopular) ?? []
  return { ...query, data: popular }
}
