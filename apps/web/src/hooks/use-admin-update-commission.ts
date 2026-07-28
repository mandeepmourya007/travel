import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { UpdateCommissionDto } from '@shared/types/admin.types'

interface AdminUpdateCommissionInput {
  organizerId: string
  dto: UpdateCommissionDto
}

/**
 * Admin: updates an organizer's OrganizerProfile.commissionRate going forward.
 *
 * Deliberately does NOT retroactively change any already-created Trip.commissionRate or
 * Booking.commissionRate snapshots — those stay frozen at whatever rate applied when the
 * trip/booking was created (see PATCH /admin/organizers/:id/commission).
 *
 * Invalidates: adminKeys.organizerDirectoryBase() (covers both the directory list and
 * this organizer's detail/trips query, since organizerTripsDetail keys nest under it).
 */
export function useAdminUpdateCommission() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ organizerId, dto }: AdminUpdateCommissionInput) => {
      const res = await apiClient.patch<{ success: true; data: { commissionRate: number } }>(
        `/admin/organizers/${organizerId}/commission`,
        dto,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizerDirectoryBase() })
      toast({ variant: 'success', title: 'Commission rate updated' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update commission rate' })
    },
  })
}
