import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { destinationKeys } from '@/lib/query-keys'
import type { DestinationDetailResponse, DestinationTripFilters } from '@shared/types/destination.types'

async function fetchDestinationDetail(
  slug: string,
  page = 1,
  filters?: DestinationTripFilters,
): Promise<DestinationDetailResponse> {
  const params: Record<string, string | number> = { page }
  if (filters?.tripType) params.tripType = filters.tripType
  if (filters?.sort) params.sort = filters.sort
  if (filters?.minPrice !== undefined) params.minPrice = filters.minPrice
  if (filters?.maxPrice !== undefined) params.maxPrice = filters.maxPrice

  const res = await apiClient.get<{ success: true; data: DestinationDetailResponse }>(
    `/destinations/slug/${slug}`,
    { params },
  )
  return res.data.data
}

export function useDestinationDetail(
  slug: string,
  page: number = 1,
  initialData?: DestinationDetailResponse,
  filters?: DestinationTripFilters,
) {
  return useQuery({
    queryKey: destinationKeys.detail(slug, { page, ...filters }),
    queryFn: () => fetchDestinationDetail(slug, page, filters),
    enabled: !!slug,
    placeholderData: keepPreviousData,
    staleTime: 0,
    initialData,
    initialDataUpdatedAt: 0,
  })
}
