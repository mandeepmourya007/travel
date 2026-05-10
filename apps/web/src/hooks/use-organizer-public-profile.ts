import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { organizerKeys } from '@/lib/query-keys'
import type { OrganizerPublicProfileResponse } from '@shared/types/organizer.types'

interface OrganizerProfileParams {
  organizerId: string
  tripsPage?: number
  tripsLimit?: number
  reviewsPage?: number
  reviewsLimit?: number
  initialData?: OrganizerPublicProfileResponse
}

export function useOrganizerPublicProfile({
  organizerId,
  tripsPage = 1,
  tripsLimit = 0,
  reviewsPage = 1,
  reviewsLimit = 10,
  initialData,
}: OrganizerProfileParams) {
  return useQuery({
    queryKey: organizerKeys.publicProfile(organizerId, { tripsPage, reviewsPage }),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerPublicProfileResponse
      }>(`/trips/organizers/${organizerId}`, {
        params: { tripsPage, tripsLimit, reviewsPage, reviewsLimit },
      })
      return res.data.data
    },
    enabled: !!organizerId,
    initialData,
    staleTime: initialData ? 5 * 60 * 1000 : 0,
    placeholderData: (prev) => prev,
  })
}
