import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { WalletController } from '../controllers/wallet.controller'
import { validate } from '../middleware/validate.middleware'
import { walletTransactionFiltersSchema, adminWalletActionSchema } from '@shared/validators/wallet.schema'

export function createWalletRoutes(
  walletController: WalletController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // ─── Traveler routes (any authenticated user) ──────
  router.get(
    '/',
    authMiddleware,
    walletController.getBalance,
  )

  router.get(
    '/transactions',
    authMiddleware,
    validate(walletTransactionFiltersSchema, 'query'),
    walletController.getTransactions,
  )

  // ─── Admin routes ──────────────────────────────────
  router.post(
    '/admin/:userId/credit',
    authMiddleware,
    requireRole('ADMIN'),
    validate(adminWalletActionSchema, 'body'),
    walletController.adminCredit,
  )

  router.post(
    '/admin/:userId/debit',
    authMiddleware,
    requireRole('ADMIN'),
    validate(adminWalletActionSchema, 'body'),
    walletController.adminDebit,
  )

  return router
}
