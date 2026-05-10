import type { Logger } from 'pino'
import type { IEmailProvider } from './email-provider.interface'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from './notification-channel.interface'
import { getEmailTemplate } from '../templates'

export class EmailNotificationProvider implements INotificationChannelProvider {
  readonly channel = 'EMAIL' as const

  constructor(
    private emailProvider: IEmailProvider,
    private logger: Logger,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    if (!payload.email) {
      return { channel: 'EMAIL', success: false, failureReason: 'No email address provided' }
    }

    try {
      const { subject, html, text } = getEmailTemplate(payload.type, payload.title, payload.body, payload.data)

      const result = await this.emailProvider.sendEmail({
        to: payload.email,
        subject,
        html,
        text,
      })

      if (!result.success) {
        return { channel: 'EMAIL', success: false, failureReason: 'Email provider returned failure' }
      }

      return { channel: 'EMAIL', success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.logger.error({ err, userId: payload.userId, type: payload.type }, 'Email notification failed')
      return { channel: 'EMAIL', success: false, failureReason: message }
    }
  }
}
