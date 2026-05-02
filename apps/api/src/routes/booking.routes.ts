import { Router } from 'express'
import type { RequestHandler } from 'express'
import { BookingController } from '../controllers/booking.controller'
import { validate } from '../middleware/validate.middleware'
import { myBookingFiltersSchema, cancelBookingSchema, createBookingSchema, verifyPaymentSchema } from '@shared/validators/booking.schema'
import { cuidParamSchema } from '@shared/validators/common.schema'

export function createBookingRoutes(
  bookingController: BookingController,
  authMiddleware: RequestHandler,
) {
  const router = Router()

  // All routes require authentication — static routes before /:id
  router.post(
    '/',
    authMiddleware,
    validate(createBookingSchema),
    bookingController.createBooking,
  )

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

  router.post(
    '/:id/verify-payment',
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(verifyPaymentSchema),
    bookingController.verifyPayment,
  )

  return router
}
