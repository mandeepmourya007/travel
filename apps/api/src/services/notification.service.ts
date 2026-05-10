import type { NotificationChannel, NotificationType } from '@prisma/client'
import type { Logger } from 'pino'
import type { NotificationRepository } from '../repositories/notification.repository'
import type { UserRepository } from '../repositories/user.repository'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from '../providers/notification-channel.interface'
import { NOTIFICATION_CHANNEL } from '@shared/constants'

/** Default channels per notification type */
const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  BOOKING_CONFIRMED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  BOOKING_CANCELLED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  PAYMENT_RECEIVED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  PAYMENT_FAILED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  REFUND_PROCESSED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  TRIP_REMINDER: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  REVIEW_REQUEST: [NOTIFICATION_CHANNEL.IN_APP],
  CHAT_MESSAGE: [NOTIFICATION_CHANNEL.IN_APP],
  ORGANIZER_APPROVED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  ORGANIZER_REJECTED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  TRIP_REQUEST_RECEIVED: [NOTIFICATION_CHANNEL.IN_APP],
  TRIP_REQUEST_APPROVED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  TRIP_REQUEST_REJECTED: [NOTIFICATION_CHANNEL.IN_APP],
  TRIP_REQUEST_EXPIRED: [NOTIFICATION_CHANNEL.IN_APP],
  ADMIN_SUPPORT_MESSAGE: [NOTIFICATION_CHANNEL.IN_APP],
  SYSTEM_ALERT: [NOTIFICATION_CHANNEL.IN_APP],
}

export interface SendNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  /** Override default channels for this notification */
  channels?: NotificationChannel[]
  /** Recipient email (auto-resolved if not provided) */
  email?: string
}

export class NotificationService {
  private providers: Map<NotificationChannel, INotificationChannelProvider>

  constructor(
    private notificationRepo: NotificationRepository,
    private userRepo: UserRepository,
    channelProviders: INotificationChannelProvider[],
    private logger: Logger,
  ) {
    this.providers = new Map()
    for (const provider of channelProviders) {
      this.providers.set(provider.channel, provider)
    }
  }

  /**
   * Send a notification to a single user across configured channels.
   * Channels execute in parallel — failures are logged, never block the caller.
   */
  async send(input: SendNotificationInput): Promise<NotificationSendResult[]> {
    const channels = input.channels ?? DEFAULT_CHANNELS[input.type] ?? [NOTIFICATION_CHANNEL.IN_APP]

    const payload: NotificationPayload = {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      email: input.email,
    }

    // Resolve email if EMAIL channel is requested but no email provided
    if (channels.includes(NOTIFICATION_CHANNEL.EMAIL) && !payload.email) {
      try {
        const user = await this.userRepo.findById(input.userId)
        if (user?.email) {
          payload.email = user.email
        }
      } catch {
        this.logger.warn({ userId: input.userId }, 'Failed to resolve user email for notification')
      }
    }

    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        const provider = this.providers.get(channel)
        if (!provider) {
          return { channel, success: false, failureReason: `No provider for channel ${channel}` } as NotificationSendResult
        }
        return provider.send(payload)
      }),
    )

    return results.map((result, idx) => {
      if (result.status === 'fulfilled') return result.value
      const channel = channels[idx]
      this.logger.error({ channel, error: result.reason }, 'Channel provider threw unexpectedly')
      return { channel, success: false, failureReason: String(result.reason) } as NotificationSendResult
    })
  }

  /**
   * Send the same notification to multiple users.
   */
  async sendBulk(inputs: SendNotificationInput[]): Promise<void> {
    await Promise.allSettled(inputs.map((input) => this.send(input)))
  }

  /**
   * Send a notification to all ADMIN users.
   */
  async sendToAdmins(input: Omit<SendNotificationInput, 'userId'>): Promise<void> {
    try {
      const admins = await this.userRepo.findByRole('ADMIN')
      if (admins.length === 0) return

      await this.sendBulk(
        admins.map((admin) => ({
          ...input,
          userId: admin.id,
          email: admin.email ?? undefined,
        })),
      )
    } catch (err) {
      this.logger.error({ err }, 'Failed to send notification to admins')
    }
  }

  // ── Read operations (delegate to repo) ─────────────────

  async getNotifications(userId: string, filters: { page: number; limit: number; unreadOnly: boolean }) {
    const { items, total } = await this.notificationRepo.findByUserId(userId, filters)
    return {
      items: items.map((n) => ({
        ...n,
        data: (n.data ?? null) as Record<string, unknown> | null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId)
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepo.markRead(notificationId, userId)
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.markAllRead(userId)
  }
}
