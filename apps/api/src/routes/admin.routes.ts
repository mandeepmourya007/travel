import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import type { AdminController } from '../controllers/admin.controller'
import { validate } from '../middleware/validate.middleware'
import {
  organizerApprovalFiltersSchema,
  approveRejectSchema,
  adminBookingFiltersSchema,
  cashbackTripFiltersSchema,
  issueCashbackSchema,
  cashbackHistoryFiltersSchema,
  reviewDocSchema,
  docTypeParamSchema,
  addDocCommentSchema,
} from '@shared/validators/admin.schema'

export function createAdminRoutes(
  adminController: AdminController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // All admin routes require ADMIN role
  router.use(authMiddleware, requireRole('ADMIN'))

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

  return router
}
