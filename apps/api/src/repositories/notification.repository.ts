import type { NotificationType, NotificationChannel, Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class NotificationRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Creates a single in-app notification.
   * Used by: AdminService (organizer approval/rejection)
   */
  async create(data: {
    userId: string
    type: NotificationType
    channel: NotificationChannel
    title: string
    body: string
    data?: unknown
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        channel: data.channel,
        title: data.title,
        body: data.body,
        data: (data.data ?? undefined) as Prisma.InputJsonValue,
        sentAt: new Date(),
      },
    })
  }
}
