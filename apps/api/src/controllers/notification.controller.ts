import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { NotificationService } from '../services/notification.service'
import type { NotificationFilters } from '@shared/types/notification.types'

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /** GET /notifications — Paginated notification list */
  getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const filters = req.query as NotificationFilters
    const result = await this.notificationService.getNotifications(userId, filters)
    res.json({ success: true, data: result.items, pagination: result.pagination })
  })

  /** GET /notifications/unread-count — Unread notification count */
  getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const count = await this.notificationService.getUnreadCount(req.user!.userId)
    res.json({ success: true, data: { count } })
  })

  /** PATCH /notifications/:id/read — Mark single notification as read */
  markRead = asyncHandler(async (req: Request, res: Response) => {
    await this.notificationService.markRead(req.params.id, req.user!.userId)
    res.json({ success: true, data: null })
  })

  /** PATCH /notifications/read-all — Mark all notifications as read */
  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    await this.notificationService.markAllRead(req.user!.userId)
    res.json({ success: true, data: null })
  })
}
