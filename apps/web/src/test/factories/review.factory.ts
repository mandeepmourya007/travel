import type { Review } from '@shared/types/review.types'
import type { AdminReviewItem } from '@shared/types/admin.types'

let counter = 0

export function resetReviewFactory() {
  counter = 0
}

export function makeReview(overrides: Partial<Review> = {}): Review {
  counter++
  return {
    id: `review_${counter}`,
    tripId: `trip_${counter}`,
    bookingId: `booking_${counter}`,
    userId: `user_${counter}`,
    overallRating: 4,
    organizationRating: null,
    valueRating: null,
    safetyRating: null,
    accuracyRating: null,
    comment: `Great trip experience #${counter}`,
    photos: [],
    editedAt: null,
    organizerReply: null,
    organizerReplyAt: null,
    createdAt: new Date('2025-06-01T10:00:00Z').toISOString(),
    user: { id: `user_${counter}`, name: `Traveler ${counter}`, avatarUrl: null },
    trip: { title: `Mountain Trek ${counter}`, slug: `mountain-trek-${counter}` },
    ...overrides,
  }
}

export function makeAdminReviewItem(overrides: Partial<AdminReviewItem> = {}): AdminReviewItem {
  counter++
  return {
    id: `review_${counter}`,
    overallRating: 4,
    comment: `Admin review comment #${counter}`,
    photos: [],
    organizerReply: null,
    editedAt: null,
    createdAt: new Date('2025-06-01T10:00:00Z').toISOString(),
    user: { id: `user_${counter}`, name: `User ${counter}`, avatarUrl: null },
    trip: {
      id: `trip_${counter}`,
      title: `Trip ${counter}`,
      slug: `trip-${counter}`,
      organizer: { businessName: `Organizer ${counter}` },
    },
    ...overrides,
  }
}

export const PAGINATION_DEFAULT = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
}
