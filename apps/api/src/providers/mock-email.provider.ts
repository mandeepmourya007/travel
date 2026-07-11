import type { Logger } from 'pino'
import type { IEmailProvider, EmailMessage, EmailSendResult } from './email-provider.interface'

export class MockEmailProvider implements IEmailProvider {
  constructor(private logger: Logger) {}

  async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    this.logger.info({ to: msg.to.replace(/(.{3}).+@/, '$1***@'), subject: msg.subject }, '[MOCK] Email sent (dev mode)')
    return { success: true }
  }

  async sendOtp(email: string, otp: string): Promise<EmailSendResult> {
    this.logger.info({ email: `${email.slice(0, 3)}***`, otp }, '[MOCK] Email OTP (dev mode)')
    return { success: true }
  }
}
