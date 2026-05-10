import type { NotificationType, NotificationChannel, Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class NotificationRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

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

  async createBulk(items: Array<{
    userId: string
    type: NotificationType
    channel: NotificationChannel
    title: string
    body: string
    data?: unknown
  }>) {
    return this.prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        type: item.type,
        channel: item.channel,
        title: item.title,
        body: item.body,
        data: (item.data ?? undefined) as Prisma.InputJsonValue,
        sentAt: new Date(),
      })),
    })
  }

  async findByUserId(
    userId: string,
    filters: { page: number; limit: number; unreadOnly: boolean },
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: 'IN_APP',
      ...(filters.unreadOnly ? { readAt: null } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        select: {
          id: true,
          userId: true,
          type: true,
          channel: true,
          title: true,
          body: true,
          data: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ])

    return { items, total }
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, channel: 'IN_APP', readAt: null },
    })
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    })
  }
}
