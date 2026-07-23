import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { BookingController } from '../controllers/booking.controller'
import { validate } from '../middleware/validate.middleware'
import {
  myBookingFiltersSchema,
  cancelBookingSchema,
  createBookingSchema,
  verifyPaymentSchema,
  bookingContactSchema,
  bookingContactVerifyOtpSchema,
} from '@shared/validators/booking.schema'
import { cuidParamSchema, tripIdParamSchema } from '@shared/validators/common.schema'
import { bookingRateLimit } from '../middleware/rate-limit.middleware'

export function createBookingRoutes(
  bookingController: BookingController,
  authMiddleware: RequestHandler,
  _requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // All routes require authentication — static routes before /:id
  router.post(
    '/',
    bookingRateLimit,
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

  router.get(
    '/my/pending-requests',
    authMiddleware,
    bookingController.getPendingRequests,
  )

  router.get(
    '/my/trip-status/:tripId',
    authMiddleware,
    validate(tripIdParamSchema, 'params'),
    bookingController.getMyTripStatus,
  )

  router.post(
    '/:id/cancel',
    bookingRateLimit,
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(cancelBookingSchema),
    bookingController.cancelBooking,
  )

  router.post(
    '/:id/verify-payment',
    bookingRateLimit,
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(verifyPaymentSchema),
    bookingController.verifyPayment,
  )

  router.post(
    '/:id/sync-payment',
    bookingRateLimit,
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    bookingController.syncPayment,
  )

  // Post-payment per-booking contact verification — booking-scoped, never
  // writes to User.phone/User.phoneVerified. See BookingService for the guard.
  router.post(
    '/:id/contact/send-otp',
    bookingRateLimit,
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(bookingContactSchema),
    bookingController.sendBookingContactOtp,
  )

  router.post(
    '/:id/contact/verify-otp',
    bookingRateLimit,
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    validate(bookingContactVerifyOtpSchema),
    bookingController.verifyBookingContactOtp,
  )

  router.post(
    '/:id/contact/use-account-phone',
    bookingRateLimit,
    authMiddleware,
    validate(cuidParamSchema, 'params'),
    bookingController.useAccountPhoneForBooking,
  )

  return router
}
