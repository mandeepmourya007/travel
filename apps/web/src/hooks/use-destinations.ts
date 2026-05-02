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

// TODO: Replace client-side filter with server-side ?popular=true query param
// once the GET /destinations endpoint supports filtering (see tech-stack.md §API)
export function usePopularDestinations() {
  const query = useDestinations()
  const popular = query.data?.filter((d) => d.isPopular) ?? []
  return { ...query, data: popular }
}
