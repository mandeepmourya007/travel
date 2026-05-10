import type { Logger } from 'pino'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from './notification-channel.interface'

/**
 * Stub push notification provider — logs a warning and returns failure.
 * Replace with Firebase Cloud Messaging or similar when ready.
 */
export class PushNotificationProvider implements INotificationChannelProvider {
  readonly channel = 'PUSH' as const

  constructor(private logger: Logger) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    this.logger.warn(
      { userId: payload.userId, type: payload.type },
      'Push provider not configured — notification skipped',
    )
    return { channel: 'PUSH', success: false, failureReason: 'Push provider not configured' }
  }
}
