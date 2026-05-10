import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { destinationKeys } from '@/lib/query-keys'
import type { DestinationDetailResponse } from '@shared/types/destination.types'

async function fetchDestinationDetail(slug: string, page = 1): Promise<DestinationDetailResponse> {
  const res = await apiClient.get<{ success: true; data: DestinationDetailResponse }>(
    `/destinations/slug/${slug}`,
    { params: { page } },
  )
  return res.data.data
}

export function useDestinationDetail(
  slug: string,
  page: number = 1,
  initialData?: DestinationDetailResponse,
) {
  return useQuery({
    queryKey: destinationKeys.detail(slug, { page }),
    queryFn: () => fetchDestinationDetail(slug, page),
    enabled: !!slug,
    initialData,
    staleTime: initialData ? 5 * 60 * 1000 : 0,
  })
}
