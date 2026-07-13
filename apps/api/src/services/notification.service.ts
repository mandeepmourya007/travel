import type { NotificationChannel, NotificationType } from '@prisma/client'
import type { Logger } from 'pino'
import type { NotificationRepository } from '../repositories/notification.repository'
import type { UserRepository } from '../repositories/user.repository'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from '../providers/notification-channel.interface'
import type { NotificationFilters } from '@shared/types/notification.types'
import { NOTIFICATION_CHANNEL } from '@shared/constants'

/** Default channels per notification type */
const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  BOOKING_CONFIRMED:          [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  BOOKING_CANCELLED:          [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  PAYMENT_RECEIVED:           [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  PAYMENT_FAILED:             [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  REFUND_PROCESSED:           [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  TRIP_REMINDER:              [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  REVIEW_REQUEST:             [NOTIFICATION_CHANNEL.IN_APP],
  CHAT_MESSAGE:               [NOTIFICATION_CHANNEL.IN_APP],
  ORGANIZER_APPROVED:         [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  ORGANIZER_REJECTED:         [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  TRIP_REQUEST_RECEIVED:      [NOTIFICATION_CHANNEL.IN_APP],
  TRIP_REQUEST_APPROVED:      [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  TRIP_REQUEST_REJECTED:      [NOTIFICATION_CHANNEL.IN_APP],
  TRIP_REQUEST_EXPIRED:       [NOTIFICATION_CHANNEL.IN_APP],
  ADMIN_SUPPORT_MESSAGE:      [NOTIFICATION_CHANNEL.IN_APP],
  SYSTEM_ALERT:               [NOTIFICATION_CHANNEL.IN_APP],
  TRIP_TYPE_REQUEST_APPROVED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  TRIP_TYPE_REQUEST_REJECTED: [NOTIFICATION_CHANNEL.IN_APP],
  DOCUMENT_REUPLOAD_REQUIRED: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
  WALLET_CREDIT_EXPIRING:     [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_CHANNEL.WHATSAPP],
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

    // Resolve email/phone in a single DB fetch — only when the channel is both
    // requested AND has a registered provider (avoids a wasted DB call when WhatsApp
    // is in DEFAULT_CHANNELS but no MSG91 keys are configured).
    const needsEmail = channels.includes(NOTIFICATION_CHANNEL.EMAIL) && this.providers.has(NOTIFICATION_CHANNEL.EMAIL) && !payload.email
    const needsPhone = channels.includes(NOTIFICATION_CHANNEL.WHATSAPP) && this.providers.has(NOTIFICATION_CHANNEL.WHATSAPP) && !payload.phone
    if (needsEmail || needsPhone) {
      try {
        const user = await this.userRepo.findById(input.userId)
        if (needsEmail && user?.email) payload.email = user.email
        if (needsPhone && user?.phone) payload.phone = user.phone
      } catch {
        this.logger.warn({ userId: input.userId }, 'Failed to resolve user contact info for notification')
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

  async getNotifications(userId: string, filters: NotificationFilters) {
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const unreadOnly = filters.unreadOnly ?? false
    const { items, total } = await this.notificationRepo.findByUserId(userId, { page, limit, unreadOnly })
    return {
      items: items.map((n) => ({
        ...n,
        data: (n.data ?? null) as Record<string, unknown> | null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
