import { z } from 'zod'
import { idSchema, paginationSchema } from './common.schema'
import { REVIEW_MAX_PHOTOS, REVIEW_MAX_COMMENT_LENGTH, REVIEW_MAX_REPLY_LENGTH, REVIEW_SORTS, REVIEW_SORT } from '../constants/review'

const ratingField = z.coerce.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5')
const optionalRatingField = z.coerce.number().int().min(1).max(5).optional()

export const createReviewSchema = z.object({
  tripId: idSchema,
  bookingId: idSchema,
  overallRating: ratingField,
  organizationRating: optionalRatingField,
  valueRating: optionalRatingField,
  safetyRating: optionalRatingField,
  accuracyRating: optionalRatingField,
  comment: z.string().max(REVIEW_MAX_COMMENT_LENGTH, `Comment must be under ${REVIEW_MAX_COMMENT_LENGTH} characters`).trim().optional(),
  photos: z.array(z.string().url()).max(REVIEW_MAX_PHOTOS, `Maximum ${REVIEW_MAX_PHOTOS} photos allowed`).optional(),
})

export const updateReviewSchema = z.object({
  overallRating: ratingField.optional(),
  organizationRating: optionalRatingField,
  valueRating: optionalRatingField,
  safetyRating: optionalRatingField,
  accuracyRating: optionalRatingField,
  comment: z.string().max(REVIEW_MAX_COMMENT_LENGTH, `Comment must be under ${REVIEW_MAX_COMMENT_LENGTH} characters`).trim().optional(),
  photos: z.array(z.string().url()).max(REVIEW_MAX_PHOTOS, `Maximum ${REVIEW_MAX_PHOTOS} photos allowed`).optional(),
})

export const organizerReplySchema = z.object({
  reply: z.string().min(1, 'Reply cannot be empty').max(REVIEW_MAX_REPLY_LENGTH, `Reply must be under ${REVIEW_MAX_REPLY_LENGTH} characters`).trim(),
})

export const reviewFiltersSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(REVIEW_SORTS).default(REVIEW_SORT.NEWEST),
})

/** Organizer dashboard — extends base with trip scoping + rating filter. */
export const organizerReviewFiltersSchema = reviewFiltersSchema.extend({
  tripId: idSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
})

/** Traveler's own reviews — extends base with optional trip scoping. */
export const travelerReviewFiltersSchema = reviewFiltersSchema.extend({
  tripId: idSchema.optional(),
})
