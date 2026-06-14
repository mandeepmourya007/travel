import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
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
    requireRole('ORGANIZER', 'ADMIN'),
    validate(paymentHistoryFiltersSchema, 'query'),
    paymentHistoryController.getTripPayments,
  )

  router.get(
    '/trip/:tripId/summary',
    authMiddleware,
    requireRole('ORGANIZER', 'ADMIN'),
    paymentHistoryController.getTripPaymentSummary,
  )

  // ─── Organizer payout statement ───────────────────
  router.get(
    '/payouts',
    authMiddleware,
    requireRole('ORGANIZER', 'ADMIN'),
    paymentHistoryController.getPayoutStatement,
  )

  router.get(
    '/trip/:tripId/payouts',
    authMiddleware,
    requireRole('ORGANIZER', 'ADMIN'),
    paymentHistoryController.getPayoutStatement,
  )

  // ─── Admin routes ──────────────────────────────────
  router.get(
    '/admin',
    authMiddleware,
    requireRole('ADMIN'),
    validate(adminPaymentFiltersSchema, 'query'),
    paymentHistoryController.getAllPayments,
  )

  router.get(
    '/admin/summary',
    authMiddleware,
    requireRole('ADMIN'),
    paymentHistoryController.getGlobalSummary,
  )

  return router
}
