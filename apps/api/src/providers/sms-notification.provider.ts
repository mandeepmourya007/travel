import type { Logger } from 'pino'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from './notification-channel.interface'

/**
 * Stub SMS provider — logs a warning and returns failure.
 * Replace with Twilio/MSG91 integration when ready.
 */
export class SmsNotificationProvider implements INotificationChannelProvider {
  readonly channel = 'SMS' as const

  constructor(private logger: Logger) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    this.logger.warn(
      { userId: payload.userId, type: payload.type },
      'SMS provider not configured — notification skipped',
    )
    return { channel: 'SMS', success: false, failureReason: 'SMS provider not configured' }
  }
}
