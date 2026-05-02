import { Router } from 'express'
import type { RequestHandler } from 'express'
import { BookingController } from '../controllers/booking.controller'
import { validate } from '../middleware/validate.middleware'
import { myBookingFiltersSchema, cancelBookingSchema } from '@shared/validators/booking.schema'
import { cuidParamSchema } from '@shared/validators/common.schema'

export function createBookingRoutes(
  bookingController: BookingController,
  authMiddleware: RequestHandler,
) {
  const router = Router()

  // All routes require authentication — static routes before /:id
  router.get(
    '/my',
    authMiddleware,
    validate(myBookingFiltersSchema, 'query'),
    bookingController.getMyBookings,
  )

  router.get(
    '/my/summary',
    authMiddleware,
    bookingController.getMyBookingSummary,
  )

  router.post(
    '/:id/cancel',
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(cancelBookingSchema),
    bookingController.cancelBooking,
  )

  return router
}
