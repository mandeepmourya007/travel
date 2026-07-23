import type { Logger } from 'pino'
import type { IOtpProvider } from '../otp-provider.interface'
import { sendMsg91WhatsappTemplate } from './msg91-whatsapp.client'

export class Msg91WhatsappOtpProvider implements IOtpProvider {
  constructor(
    private authKey: string,
    private businessNumber: string,
    private templateName: string,
    private logger: Logger,
  ) {}

  async sendOtp(phone: string, otp: string): Promise<{ success: boolean; channel: 'sms' | 'whatsapp' }> {
    // otp_tripeeeh ships with a "Copy Code" URL button — MSG91 requires its
    // dynamic suffix parameter separately from the body variable, both set to the OTP.
    const result = await sendMsg91WhatsappTemplate(
      this.authKey, this.businessNumber, phone, this.templateName, [otp], otp,
    )

    if (!result.success) {
      this.logger.error(
        { status: result.status, body: result.errorBody, err: result.networkError, phone: `****${phone.slice(-4)}` },
        'MSG91 WhatsApp OTP send failed',
      )
      return { success: false, channel: 'whatsapp' }
    }

    this.logger.info({ phone: `****${phone.slice(-4)}` }, 'OTP sent via MSG91 WhatsApp')
    return { success: true, channel: 'whatsapp' }
  }
}
