import { Router } from 'express'
import { DestinationController } from '../controllers/destination.controller'
import { validate } from '../middleware/validate.middleware'
import { createDestinationSchema, updateDestinationSchema, destinationDetailQuerySchema } from '@shared/validators/destination.schema'
import { cuidParamSchema, slugParamSchema } from '@shared/validators/common.schema'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'

export function createDestinationRoutes(
  destinationController: DestinationController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // Public
  router.get('/', destinationController.list)
  router.get(
    '/slug/:slug',
    validate(slugParamSchema, 'params'),
    validate(destinationDetailQuerySchema, 'query'),
    destinationController.getBySlug,
  )
  router.get('/:id', validate(cuidParamSchema, 'params'), destinationController.getById)

  // Admin only
  router.post(
    '/',
    authMiddleware,
    requireRole('ADMIN'),
    validate(createDestinationSchema),
    destinationController.create,
  )
  router.put(
    '/:id',
    validate(cuidParamSchema, 'params'),
    authMiddleware,
    requireRole('ADMIN'),
    validate(updateDestinationSchema),
    destinationController.update,
  )
  router.delete(
    '/:id',
    validate(cuidParamSchema, 'params'),
    authMiddleware,
    requireRole('ADMIN'),
    destinationController.delete,
  )

  return router
}
