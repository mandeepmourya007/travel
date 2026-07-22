import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'
import { ReviewController } from '../controllers/review.controller'
import { validate } from '../middleware/validate.middleware'
import { createReviewSchema, updateReviewSchema, organizerReplySchema, reviewFiltersSchema, organizerReviewFiltersSchema, travelerReviewFiltersSchema } from '@shared/validators/review.schema'
import { cuidParamSchema, bookingIdParamSchema, tripIdParamSchema } from '@shared/validators/common.schema'

export function createReviewRoutes(
  reviewController: ReviewController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
  requirePhoneVerified: RequestHandler,
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
    requirePhoneVerified,
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
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    validate(organizerReplySchema),
    reviewController.addOrganizerReply,
  )

  // Organizer — dashboard reviews list with trip/rating/sort filters
  router.get(
    '/organizer/mine',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(organizerReviewFiltersSchema, 'query'),
    reviewController.getOrganizerReviews,
  )

  // Authenticated — traveler's own written reviews
  router.get(
    '/my',
    authMiddleware,
    validate(travelerReviewFiltersSchema, 'query'),
    reviewController.getMyReviews,
  )

  return router
}
