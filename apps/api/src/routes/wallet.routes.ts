import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'
import { WalletController } from '../controllers/wallet.controller'
import { validate } from '../middleware/validate.middleware'
import { walletTransactionFiltersSchema, adminWalletActionSchema } from '@shared/validators/wallet.schema'
import { paginationSchema } from '@shared/validators/common.schema'

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

  router.get(
    '/cashback',
    authMiddleware,
    validate(paginationSchema, 'query'),
    walletController.getCashbackHistory,
  )

  // ─── Admin routes ──────────────────────────────────
  router.post(
    '/admin/:userId/credit',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    validate(adminWalletActionSchema, 'body'),
    walletController.adminCredit,
  )

  router.post(
    '/admin/:userId/debit',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    validate(adminWalletActionSchema, 'body'),
    walletController.adminDebit,
  )

  return router
}
