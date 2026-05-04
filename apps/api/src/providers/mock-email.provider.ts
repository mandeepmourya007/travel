import type { Logger } from 'pino'
import type { IEmailProvider, EmailMessage } from './email-provider.interface'

export class MockEmailProvider implements IEmailProvider {
  constructor(private logger: Logger) {}

  async sendEmail(msg: EmailMessage): Promise<{ success: boolean }> {
    this.logger.info({ to: msg.to.replace(/(.{3}).+@/, '$1***@'), subject: msg.subject }, '[MOCK] Email sent (dev mode)')
    return { success: true }
  }

  async sendOtp(email: string, otp: string): Promise<{ success: boolean }> {
    this.logger.info({ email: `${email.slice(0, 3)}***`, otp }, '[MOCK] Email OTP (dev mode)')
    return { success: true }
  }
}
