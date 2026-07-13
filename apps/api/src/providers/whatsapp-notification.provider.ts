import type { Logger } from 'pino'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from './notification-channel.interface'
import { MSG91_WA_API_URL } from '../utils/constants'

type TextParam = { type: 'text'; text: string }

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

    const params = this.buildParams(payload.type, payload.data)
    const success = await this.callMsgApi(payload.phone, templateName, params)

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
    const textParams = toParams(params)
    const success = await this.callMsgApi(phone, templateName, textParams)
    if (!success) {
      return { channel: 'WHATSAPP', success: false, failureReason: 'MSG91 API error' }
    }
    return { channel: 'WHATSAPP', success: true }
  }

  // ── Private helpers ────────────────────────────────

  private buildParams(type: string, data: Record<string, unknown> | undefined): TextParam[] {
    switch (type) {
      case 'BOOKING_CONFIRMED':
        return toParams([data?.tripName, data?.bookingId])
      case 'BOOKING_CANCELLED':
        return toParams([data?.tripName])
      case 'PAYMENT_RECEIVED':
        return toParams([data?.amount, data?.tripName])
      case 'PAYMENT_FAILED':
        return toParams([data?.tripName])
      case 'REFUND_PROCESSED':
        return toParams([data?.amount, data?.tripName])
      case 'TRIP_REMINDER':
        return toParams([data?.tripName, data?.pickupLabel, data?.pickupTime])
      case 'ORGANIZER_APPROVED':
        return toParams([])
      case 'ORGANIZER_REJECTED':
        return toParams([data?.reason])
      case 'TRIP_REQUEST_APPROVED':
        return toParams([data?.tripName])
      case 'DOCUMENT_REUPLOAD_REQUIRED':
        return toParams([data?.docType, data?.reason])
      case 'WALLET_CREDIT_EXPIRING':
        return toParams([data?.daysLeft, data?.amount])
      case 'TRIP_TYPE_REQUEST_APPROVED':
        return toParams([data?.tripType])
      default:
        return toParams([data?.title])
    }
  }

  private async callMsgApi(to: string, templateName: string, params: TextParam[]): Promise<boolean> {
    const body = {
      integrated_number: `91${this.businessNumber}`,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: params.length > 0
            ? [{ type: 'body', parameters: params }]
            : [],
        },
        to: `91${to}`,
      },
    }

    try {
      const res = await fetch(MSG91_WA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text()
        this.logger.error(
          { status: res.status, body: text, phone: `****${to.slice(-4)}`, templateName },
          'MSG91 WhatsApp API call failed',
        )
        return false
      }

      return true
    } catch (err) {
      this.logger.error({ err, phone: `****${to.slice(-4)}`, templateName }, 'MSG91 WhatsApp network error')
      return false
    }
  }
}

function toParams(vals: unknown[]): TextParam[] {
  return vals.map((v) => ({ type: 'text' as const, text: String(v ?? '') }))
}
