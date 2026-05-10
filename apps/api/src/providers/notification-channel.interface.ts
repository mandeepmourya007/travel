import type { NotificationChannel, NotificationType } from '@prisma/client'

export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  /** Recipient email — required for EMAIL channel */
  email?: string
  /** Recipient phone — required for SMS/WHATSAPP channels */
  phone?: string
}

export interface NotificationSendResult {
  channel: NotificationChannel
  success: boolean
  /** DB record ID if persisted (IN_APP) */
  notificationId?: string
  failureReason?: string
}

export interface INotificationChannelProvider {
  readonly channel: NotificationChannel
  send(payload: NotificationPayload): Promise<NotificationSendResult>
}
