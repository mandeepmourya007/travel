import type { Logger } from 'pino'
import type { IOtpProvider } from './otp-provider.interface'
import { MSG91_WA_API_URL } from '../utils/constants'

export class Msg91WhatsappOtpProvider implements IOtpProvider {
  constructor(
    private authKey: string,
    private businessNumber: string,
    private templateName: string,
    private logger: Logger,
  ) {}

  async sendOtp(phone: string, otp: string): Promise<{ success: boolean; channel: 'sms' | 'whatsapp' }> {
    const body = {
      integrated_number: `91${this.businessNumber}`,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: this.templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otp }],
            },
          ],
        },
        to: `91${phone}`,
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
          { status: res.status, body: text, phone: `****${phone.slice(-4)}` },
          'MSG91 WhatsApp OTP send failed',
        )
        return { success: false, channel: 'whatsapp' }
      }

      this.logger.info({ phone: `****${phone.slice(-4)}` }, 'OTP sent via MSG91 WhatsApp')
      return { success: true, channel: 'whatsapp' }
    } catch (err) {
      this.logger.error({ err, phone: `****${phone.slice(-4)}` }, 'MSG91 WhatsApp OTP network error')
      return { success: false, channel: 'whatsapp' }
    }
  }
}
