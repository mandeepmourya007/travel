import type { Logger } from 'pino'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from '../notification-channel.interface'
import { sendMsg91WhatsappTemplate } from './msg91-whatsapp.client'

export class WhatsappNotificationProvider implements INotificationChannelProvider {
  readonly channel = 'WHATSAPP' as const

  constructor(
    private authKey: string,
    private businessNumber: string,
    /** Maps NotificationType string → Meta-approved template name */
    private templateMap: Partial<Record<string, string>>,
    private logger: Logger,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    if (!payload.phone) {
      return { channel: 'WHATSAPP', success: false, failureReason: 'No phone number' }
    }

    const templateName = this.templateMap[payload.type]
    if (!templateName) {
      this.logger.warn(
        { userId: payload.userId, type: payload.type },
        'WhatsApp notification skipped — no template configured for type',
      )
      return { channel: 'WHATSAPP', success: false, failureReason: 'No template configured' }
    }

    const values = this.buildValues(payload.type, payload.data)
    const success = await this.callMsgApi(payload.phone, templateName, values)

    if (!success) {
      return { channel: 'WHATSAPP', success: false, failureReason: 'MSG91 API error' }
    }

    return { channel: 'WHATSAPP', success: true }
  }

  /**
   * Send a promotional message with a caller-supplied template and params.
   * Used by WhatsappBroadcastService.
   */
  async sendPromo(phone: string, templateName: string, params: string[]): Promise<NotificationSendResult> {
    const success = await this.callMsgApi(phone, templateName, params)
    if (!success) {
      return { channel: 'WHATSAPP', success: false, failureReason: 'MSG91 API error' }
    }
    return { channel: 'WHATSAPP', success: true }
  }

  // ── Private helpers ────────────────────────────────

  private buildValues(type: string, data: Record<string, unknown> | undefined): unknown[] {
    switch (type) {
      case 'BOOKING_CONFIRMED':
        return [data?.tripName, data?.bookingId]
      case 'BOOKING_CANCELLED':
        return [data?.tripName]
      case 'PAYMENT_RECEIVED':
        return [data?.amount, data?.tripName]
      case 'PAYMENT_FAILED':
        return [data?.tripName]
      case 'REFUND_PROCESSED':
        return [data?.amount, data?.tripName]
      case 'TRIP_REMINDER':
        return [data?.tripName, data?.pickupLabel, data?.pickupTime]
      case 'ORGANIZER_APPROVED':
        return []
      case 'ORGANIZER_REJECTED':
        return [data?.reason]
      case 'TRIP_REQUEST_APPROVED':
        return [data?.tripName]
      case 'DOCUMENT_REUPLOAD_REQUIRED':
        return [data?.docType, data?.reason]
      case 'WALLET_CREDIT_EXPIRING':
        return [data?.daysLeft, data?.amount]
      case 'TRIP_TYPE_REQUEST_APPROVED':
        return [data?.tripType]
      default:
        return [data?.title]
    }
  }

  private async callMsgApi(to: string, templateName: string, values: unknown[]): Promise<boolean> {
    const result = await sendMsg91WhatsappTemplate(this.authKey, this.businessNumber, to, templateName, values)

    if (!result.success) {
      this.logger.error(
        { status: result.status, body: result.errorBody, err: result.networkError, phone: `****${to.slice(-4)}`, templateName },
        'MSG91 WhatsApp API call failed',
      )
      return false
    }

    return true
  }
}
