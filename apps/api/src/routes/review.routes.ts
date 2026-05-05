import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { ReviewController } from '../controllers/review.controller'
import { validate } from '../middleware/validate.middleware'
import { createReviewSchema, updateReviewSchema, organizerReplySchema, reviewFiltersSchema } from '@shared/validators/review.schema'
import { cuidParamSchema, bookingIdParamSchema, tripIdParamSchema } from '@shared/validators/common.schema'

export function createReviewRoutes(
  reviewController: ReviewController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // Public — get reviews for a trip
  router.get(
    '/trip/:tripId',
    validate(tripIdParamSchema, 'params'),
    validate(reviewFiltersSchema, 'query'),
    reviewController.getTripReviews,
  )

  // Authenticated — create review
  router.post(
    '/',
    authMiddleware,
    validate(createReviewSchema),
    reviewController.createReview,
  )

  // Authenticated — get own review for a booking
  router.get(
    '/my/booking/:bookingId',
    authMiddleware,
    validate(bookingIdParamSchema, 'params'),
    reviewController.getMyReview,
  )

  // Authenticated — update own review
  router.put(
    '/:id',
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(updateReviewSchema),
    reviewController.updateReview,
  )

  // Authenticated — organizer reply
  router.post(
    '/:id/reply',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(cuidParamSchema, 'params'),
    validate(organizerReplySchema),
    reviewController.addOrganizerReply,
  )

  return router
}
