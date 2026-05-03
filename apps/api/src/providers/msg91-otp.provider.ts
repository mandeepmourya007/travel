import type { Logger } from 'pino'
import type { IOtpProvider } from './otp-provider.interface'

export class Msg91OtpProvider implements IOtpProvider {
  constructor(
    private authKey: string,
    private templateId: string,
    private logger: Logger,
  ) {}

  async sendOtp(phone: string, otp: string): Promise<{ success: boolean; channel: 'sms' | 'whatsapp' }> {
    const url = 'https://control.msg91.com/api/v5/flow/'
    const body = {
      template_id: this.templateId,
      short_url: '0',
      mobiles: `91${phone}`,
      otp,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: this.authKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      this.logger.error({ status: res.status, body: text, phone: `****${phone.slice(-4)}` }, 'MSG91 send failed')
      return { success: false, channel: 'sms' }
    }

    this.logger.info({ phone: `****${phone.slice(-4)}` }, 'OTP sent via MSG91')
    return { success: true, channel: 'sms' }
  }
}
