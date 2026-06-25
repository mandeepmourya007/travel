import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'
import { PaymentHistoryController } from '../controllers/payment-history.controller'
import { validate } from '../middleware/validate.middleware'
import { paymentHistoryFiltersSchema, adminPaymentFiltersSchema } from '@shared/validators/payment.schema'

export function createPaymentRoutes(
  paymentHistoryController: PaymentHistoryController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // ─── Traveler routes (any authenticated user) ──────
  router.get(
    '/my',
    authMiddleware,
    validate(paymentHistoryFiltersSchema, 'query'),
    paymentHistoryController.getMyPayments,
  )

  router.get(
    '/my/summary',
    authMiddleware,
    paymentHistoryController.getMyPaymentSummary,
  )

  // ─── Organizer routes ──────────────────────────────
  router.get(
    '/trip/:tripId',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(paymentHistoryFiltersSchema, 'query'),
    paymentHistoryController.getTripPayments,
  )

  router.get(
    '/trip/:tripId/summary',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    paymentHistoryController.getTripPaymentSummary,
  )

  // ─── Organizer payout statement ───────────────────
  router.get(
    '/payouts',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    paymentHistoryController.getPayoutStatement,
  )

  router.get(
    '/trip/:tripId/payouts',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    paymentHistoryController.getPayoutStatement,
  )

  // ─── Admin routes ──────────────────────────────────
  router.get(
    '/admin',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    validate(adminPaymentFiltersSchema, 'query'),
    paymentHistoryController.getAllPayments,
  )

  router.get(
    '/admin/summary',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    paymentHistoryController.getGlobalSummary,
  )

  return router
}
