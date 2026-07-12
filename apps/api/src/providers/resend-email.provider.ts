import { Resend } from 'resend'
import type { Logger } from 'pino'
import type { IEmailProvider, EmailMessage, EmailSendResult } from './email-provider.interface'

export class ResendEmailProvider implements IEmailProvider {
  private client: Resend

  constructor(
    apiKey: string,
    private from: string,
    /** Default reply-to shown to recipients — improves trust signals and inbox placement. */
    private replyTo: string,
    private logger: Logger,
  ) {
    this.client = new Resend(apiKey)
  }

  async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    const maskedTo = msg.to.replace(/(.{3}).+@/, '$1***@')
    const replyTo = msg.replyTo ?? this.replyTo
    this.logger.info({ to: maskedTo, subject: msg.subject }, 'Resend: attempting send')
    const { error } = await this.client.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo,
      headers: { 'List-Unsubscribe': `<mailto:${replyTo}>`, ...msg.headers },
    })
    if (error) {
      this.logger.error({ to: maskedTo, error }, 'Resend: email send failed')
      return { success: false, error }
    }
    this.logger.info({ to: maskedTo, subject: msg.subject }, 'Resend: email sent')
    return { success: true }
  }

  async sendOtp(email: string, otp: string): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: 'Your verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 16px;">Verification Code</h2>
          <p style="color: #555; margin: 0 0 24px;">Use this code to verify your email:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 12px; margin: 24px 0 0;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
      text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    })
  }
}
