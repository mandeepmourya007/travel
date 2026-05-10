import type { Logger } from 'pino'
import type { Server } from 'socket.io'
import type { NotificationRepository } from '../repositories/notification.repository'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from './notification-channel.interface'

export class InAppNotificationProvider implements INotificationChannelProvider {
  readonly channel = 'IN_APP' as const

  constructor(
    private notificationRepo: NotificationRepository,
    private getIo: () => Server | null,
    private logger: Logger,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    try {
      const record = await this.notificationRepo.create({
        userId: payload.userId,
        type: payload.type,
        channel: 'IN_APP',
        title: payload.title,
        body: payload.body,
        data: payload.data,
      })

      // Push via Socket.IO to user's personal room
      const io = this.getIo()
      if (io) {
        io.to(`user:${payload.userId}`).emit('notification:new', {
          id: record.id,
          userId: payload.userId,
          type: record.type,
          title: record.title,
          body: record.body,
          data: record.data,
          createdAt: record.createdAt.toISOString(),
        })
      }

      return { channel: 'IN_APP', success: true, notificationId: record.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.logger.error({ err, userId: payload.userId, type: payload.type }, 'InApp notification failed')
      return { channel: 'IN_APP', success: false, failureReason: message }
    }
  }
}
