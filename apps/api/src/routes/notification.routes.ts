import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import type { NotificationController } from '../controllers/notification.controller'
import { validate } from '../middleware/validate.middleware'
import { notificationFiltersSchema, markReadParamsSchema } from '@shared/validators/notification.schema'

export function createNotificationRoutes(
  notificationController: NotificationController,
  authMiddleware: RequestHandler,
  _requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  router.get(
    '/',
    authMiddleware,
    validate(notificationFiltersSchema, 'query'),
    notificationController.getNotifications,
  )

  router.get(
    '/unread-count',
    authMiddleware,
    notificationController.getUnreadCount,
  )

  router.patch(
    '/read-all',
    authMiddleware,
    notificationController.markAllRead,
  )

  router.patch(
    '/:id/read',
    authMiddleware,
    validate(markReadParamsSchema, 'params'),
    notificationController.markRead,
  )

  return router
}
