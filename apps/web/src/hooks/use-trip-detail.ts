import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys } from '@/lib/query-keys'
import type { TripDetail } from '@shared/types/trip.types'

export async function fetchTripDetail(slug: string): Promise<TripDetail> {
  const res = await apiClient.get<{ success: true; data: TripDetail }>(
    `/trips/slug/${slug}`,
  )
  return res.data.data
}

export function useTripDetail(slug: string, initialData?: TripDetail) {
  return useQuery({
    queryKey: tripKeys.detail(slug),
    queryFn: () => fetchTripDetail(slug),
    enabled: !!slug,
    initialData,
    staleTime: 0,
  })
}
