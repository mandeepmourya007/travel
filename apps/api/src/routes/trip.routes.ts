import { Router } from 'express'
import { TripController } from '../controllers/trip.controller'
import { validate } from '../middleware/validate.middleware'
import { cacheControl } from '../middleware/cache-control.middleware'
import { createTripSchema, updateTripSchema, tripFiltersSchema } from '@shared/validators/trip.schema'
import { cuidParamSchema, slugParamSchema, tripIdParamSchema, tripRequestParamSchema, organizerIdParamSchema, organizerProfileQuerySchema } from '@shared/validators/common.schema'
import { tripBookingFiltersSchema, tripRequestFiltersSchema, respondTripRequestSchema, createTripRequestBodySchema } from '@shared/validators/booking.schema'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'

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
    requireRole(USER_ROLE.ORGANIZER),
    tripController.getMyTrips,
  )

  router.get(
    '/organizer/stats',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    tripController.getOrganizerStats,
  )

  router.get(
    '/organizer/pending-requests',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    tripController.getAllPendingRequests,
  )

  // Public
  router.get('/', cacheControl(60), validate(tripFiltersSchema, 'query'), tripController.search)
  router.get('/slug/:slug', cacheControl(300), validate(slugParamSchema, 'params'), tripController.getBySlug)
  router.get(
    '/organizers/slug/:slug',
    validate(slugParamSchema, 'params'),
    validate(organizerProfileQuerySchema, 'query'),
    tripController.getOrganizerPublicProfileBySlug,
  )
  router.get(
    '/organizers/:organizerId',
    validate(organizerIdParamSchema, 'params'),
    validate(organizerProfileQuerySchema, 'query'),
    tripController.getOrganizerPublicProfile,
  )
  router.get('/:id', validate(cuidParamSchema, 'params'), tripController.getById)
  router.post(
    '/',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(createTripSchema),
    tripController.create,
  )
  router.put(
    '/:id',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    validate(updateTripSchema),
    tripController.update,
  )
  router.post(
    '/:id/publish',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    tripController.publish,
  )
  router.post(
    '/:id/duplicate',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    tripController.duplicate,
  )
  router.delete(
    '/:id',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    tripController.delete,
  )
  router.patch(
    '/:id/toggle-bookings',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    tripController.toggleBookings,
  )
  router.get(
    '/:id/history',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(cuidParamSchema, 'params'),
    tripController.getEditHistory,
  )

  // ─── Traveler Trip Request ──────────────────────────
  router.post(
    '/:tripId/request',
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER),
    validate(tripIdParamSchema, 'params'),
    validate(createTripRequestBodySchema),
    tripController.createRequest,
  )

  // ─── Trip Participants Dashboard (organizer only) ────
  router.get(
    '/:tripId/bookings',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(tripIdParamSchema, 'params'),
    validate(tripBookingFiltersSchema, 'query'),
    tripController.getTripBookings,
  )
  router.get(
    '/:tripId/requests',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(tripIdParamSchema, 'params'),
    validate(tripRequestFiltersSchema, 'query'),
    tripController.getTripRequests,
  )
  router.get(
    '/:tripId/summary',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(tripIdParamSchema, 'params'),
    tripController.getTripBookingSummary,
  )
  router.patch(
    '/:tripId/requests/:requestId',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(tripRequestParamSchema, 'params'),
    validate(respondTripRequestSchema),
    tripController.respondToRequest,
  )

  return router
}
