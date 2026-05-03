import type { Logger } from 'pino'
import type { IOtpProvider } from './otp-provider.interface'

export class MockOtpProvider implements IOtpProvider {
  constructor(private logger: Logger) {}

  async sendOtp(phone: string, _otp: string): Promise<{ success: boolean; channel: 'sms' | 'whatsapp' }> {
    this.logger.info({ phone: `****${phone.slice(-4)}` }, '[MOCK] OTP sent (dev mode)')
    return { success: true, channel: 'sms' }
  }
}
