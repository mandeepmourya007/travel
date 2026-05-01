import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import type { TripDetail } from '@shared/types/trip.types'

export function useTripDetail(slug: string) {
  return useQuery({
    queryKey: tripKeys.detail(slug),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: TripDetail }>(
        `/trips/slug/${slug}`,
      )
      return res.data.data
    },
    enabled: !!slug,
  })
}
