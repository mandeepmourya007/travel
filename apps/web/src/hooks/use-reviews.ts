import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { reviewKeys, bookingKeys, tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { Review, CreateReviewDto, UpdateReviewDto, ReviewListFilters, ReviewSummary } from '@shared/types/review.types'

// ─── Read Hooks ─────────────────────────────────────

/**
 * Fetches paginated reviews for a trip (public, no auth).
 * Includes rating summary (average, distribution).
 */
export function useTripReviews(tripId: string, filters?: ReviewListFilters) {
  return useQuery({
    queryKey: reviewKeys.forTrip(tripId, filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: { reviews: Review[]; summary: ReviewSummary }
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>('/reviews/trip/' + tripId, { params: filters })
      return { reviews: res.data.data.reviews, summary: res.data.data.summary, pagination: res.data.pagination }
    },
    enabled: !!tripId,
  })
}

/**
 * Fetches the current user's review for a specific booking.
 * Returns null if no review exists yet.
 */
export function useMyReviewForBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.myForBooking(bookingId!),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: Review | null }>(
        `/reviews/my/booking/${bookingId}`,
      )
      return res.data.data
    },
    enabled: !!bookingId,
  })
}

// ─── Write Hooks ────────────────────────────────────

/**
 * Creates a review for a completed booking.
 * Invalidates: reviewKeys.all, bookingKeys.all, trip detail cache.
 */
export function useCreateReview() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (dto: CreateReviewDto) => {
      const res = await apiClient.post<{ success: true; data: Review }>('/reviews', dto)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      toast({ variant: 'success', title: 'Review submitted! Thank you for your feedback.' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to submit review. Please try again.' })
    },
  })
}

/**
 * Updates an existing review (within 30-day edit window).
 * Invalidates: reviewKeys.all, tripKeys.all.
 */
export function useUpdateReview() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ reviewId, dto }: { reviewId: string; dto: UpdateReviewDto }) => {
      const res = await apiClient.put<{ success: true; data: Review }>(`/reviews/${reviewId}`, dto)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      toast({ variant: 'success', title: 'Review updated!' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update review. Please try again.' })
    },
  })
}

/**
 * Adds an organizer reply to a review.
 * Invalidates: reviewKeys.all, tripKeys.all.
 */
export function useAddOrganizerReply() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const res = await apiClient.post<{ success: true; data: Review }>(
        `/reviews/${reviewId}/reply`,
        { reply },
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
      queryClient.invalidateQueries({ queryKey: organizerKeys.all })
      toast({ variant: 'success', title: 'Reply posted!' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to post reply. Please try again.' })
    },
  })
}
