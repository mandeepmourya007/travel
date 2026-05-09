import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import type { AdminController } from '../controllers/admin.controller'
import { validate } from '../middleware/validate.middleware'
import {
  organizerApprovalFiltersSchema,
  approveRejectSchema,
  adminBookingFiltersSchema,
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

  return router
}
