import { Router } from 'express'
import { TripController } from '../controllers/trip.controller'
import { validate } from '../middleware/validate.middleware'
import { createTripSchema, updateTripSchema, tripFiltersSchema } from '@shared/validators/trip.schema'
import { cuidParamSchema, slugParamSchema, tripIdParamSchema, tripRequestParamSchema } from '@shared/validators/common.schema'
import { tripBookingFiltersSchema, tripRequestFiltersSchema, respondTripRequestSchema } from '@shared/validators/booking.schema'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'

export function createTripRoutes(
  tripController: TripController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // Organizer only (static routes before /:id)
  router.get(
    '/my/list',
    authMiddleware,
    requireRole('ORGANIZER'),
    tripController.getMyTrips,
  )

  router.get(
    '/organizer/stats',
    authMiddleware,
    requireRole('ORGANIZER'),
    tripController.getOrganizerStats,
  )

  // Public
  router.get('/', validate(tripFiltersSchema, 'query'), tripController.search)
  router.get('/slug/:slug', validate(slugParamSchema, 'params'), tripController.getBySlug)
  router.get('/:id', validate(cuidParamSchema, 'params'), tripController.getById)
  router.post(
    '/',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(createTripSchema),
    tripController.create,
  )
  router.put(
    '/:id',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(cuidParamSchema, 'params'),
    validate(updateTripSchema),
    tripController.update,
  )
  router.post(
    '/:id/publish',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(cuidParamSchema, 'params'),
    tripController.publish,
  )
  router.delete(
    '/:id',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(cuidParamSchema, 'params'),
    tripController.delete,
  )
  router.patch(
    '/:id/toggle-bookings',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(cuidParamSchema, 'params'),
    tripController.toggleBookings,
  )
  router.get(
    '/:id/history',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(cuidParamSchema, 'params'),
    tripController.getEditHistory,
  )

  // ─── Trip Participants Dashboard (organizer only) ────
  router.get(
    '/:tripId/bookings',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(tripIdParamSchema, 'params'),
    validate(tripBookingFiltersSchema, 'query'),
    tripController.getTripBookings,
  )
  router.get(
    '/:tripId/requests',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(tripIdParamSchema, 'params'),
    validate(tripRequestFiltersSchema, 'query'),
    tripController.getTripRequests,
  )
  router.get(
    '/:tripId/summary',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(tripIdParamSchema, 'params'),
    tripController.getTripBookingSummary,
  )
  router.patch(
    '/:tripId/requests/:requestId',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(tripRequestParamSchema, 'params'),
    validate(respondTripRequestSchema),
    tripController.respondToRequest,
  )

  return router
}
