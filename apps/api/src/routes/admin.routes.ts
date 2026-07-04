import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'
import type { AdminController } from '../controllers/admin.controller'
import { validate } from '../middleware/validate.middleware'
import {
  organizerApprovalFiltersSchema,
  approveRejectSchema,
  adminBookingFiltersSchema,
  adminTripFiltersSchema,
  cashbackTripFiltersSchema,
  issueCashbackSchema,
  cashbackHistoryFiltersSchema,
  reviewDocSchema,
  docTypeParamSchema,
  addDocCommentSchema,
  organizerInviteFiltersSchema,
} from '@shared/validators/admin.schema'
import { adminToggleBookingsSchema, adminSetVisibilitySchema } from '@shared/validators/trip.schema'
import { cuidParamSchema } from '@shared/validators/common.schema'

export function createAdminRoutes(
  adminController: AdminController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // All admin routes require ADMIN role
  router.use(authMiddleware, requireRole(USER_ROLE.ADMIN))

  // ─── Organizer Approvals ──────────────────────────────
  router.get(
    '/organizers',
    validate(organizerApprovalFiltersSchema, 'query'),
    adminController.getApprovalQueue,
  )

  router.get(
    '/organizers/:id',
    adminController.getOrganizerDetail,
  )

  router.patch(
    '/organizers/:id/status',
    validate(approveRejectSchema, 'body'),
    adminController.approveOrReject,
  )

  // ─── Document Review ────────────────────────────────
  router.get(
    '/organizers/:id/documents',
    adminController.getDocReviewDetail,
  )

  router.patch(
    '/organizers/:id/documents/:docType/review',
    validate(docTypeParamSchema, 'params'),
    validate(reviewDocSchema, 'body'),
    adminController.reviewDocument,
  )

  router.post(
    '/organizers/:id/comments',
    validate(addDocCommentSchema, 'body'),
    adminController.addDocComment,
  )

  // ─── Organizer Invites ────────────────────────────────
  router.get('/organizer-invites', validate(organizerInviteFiltersSchema, 'query'), adminController.getOrganizerInvites)

  // ─── Platform Stats ───────────────────────────────────
  router.get('/stats', adminController.getPlatformStats)

  // ─── Admin Bookings ───────────────────────────────────
  router.get(
    '/bookings',
    validate(adminBookingFiltersSchema, 'query'),
    adminController.getBookings,
  )

  router.get(
    '/bookings/:id',
    adminController.getBookingDetail,
  )

  // ─── Cashback ───────────────────────────────────────
  router.get(
    '/cashback/trips',
    validate(cashbackTripFiltersSchema, 'query'),
    adminController.getCompletedTripsForCashback,
  )

  router.get(
    '/cashback/trips/:tripId',
    adminController.getTripCashbackDetail,
  )

  router.post(
    '/cashback/issue',
    validate(issueCashbackSchema, 'body'),
    adminController.issueCashback,
  )

  router.get(
    '/cashback/by-user',
    validate(cashbackHistoryFiltersSchema, 'query'),
    adminController.getCashbackHistoryByUser,
  )

  router.get(
    '/cashback/by-user/:userId',
    validate(cashbackHistoryFiltersSchema, 'query'),
    adminController.getCashbackUserDetail,
  )

  router.get(
    '/cashback/by-trip',
    validate(cashbackHistoryFiltersSchema, 'query'),
    adminController.getCashbackHistoryByTrip,
  )

  // ─── Trip Controls ─────────────────────────────────
  router.get(
    '/trips',
    validate(adminTripFiltersSchema, 'query'),
    adminController.adminGetTrips,
  )

  router.patch(
    '/trips/:id/bookings',
    validate(cuidParamSchema, 'params'),
    validate(adminToggleBookingsSchema),
    adminController.adminSetBookingPause,
  )

  router.patch(
    '/trips/:id/visibility',
    validate(cuidParamSchema, 'params'),
    validate(adminSetVisibilitySchema),
    adminController.adminSetVisibility,
  )

  return router
}
