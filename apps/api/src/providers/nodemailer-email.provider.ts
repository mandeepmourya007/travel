import dns from 'dns/promises'
import nodemailer from 'nodemailer'
import type { Logger } from 'pino'
import type { IEmailProvider, EmailMessage } from './email-provider.interface'

export interface SmtpConfig {
  host: string
  port: number
  auth: { user: string; pass: string }
}

export class NodemailerEmailProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter | null = null
  private readonly ready: Promise<void>

  constructor(
    private config: SmtpConfig,
    private from: string,
    private logger: Logger,
  ) {
    this.ready = this.init()
  }

  // Nodemailer's internal DNS resolution can return IPv6 addresses, which some
  // hosts (e.g. Render free tier) block on outbound SMTP. Resolve to IPv4
  // explicitly before handing the host to the transporter.
  private async init(): Promise<void> {
    let host = this.config.host
    try {
      const [ipv4] = await dns.resolve4(this.config.host)
      host = ipv4
      this.logger.info({ original: this.config.host, resolved: host }, 'SMTP: resolved to IPv4')
    } catch {
      this.logger.warn({ host: this.config.host }, 'SMTP: IPv4 resolve failed, falling back to hostname')
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth: this.config.auth,
      // Required when host is an IP: nodemailer needs the original hostname
      // for TLS SNI so the server certificate validates correctly.
      ...(host !== this.config.host && { tls: { servername: this.config.host } }),
      connectionTimeout: 8000,
      socketTimeout: 8000,
      greetingTimeout: 8000,
    })
  }

  async sendEmail(msg: EmailMessage): Promise<{ success: boolean }> {
    await this.ready
    const start = Date.now()
    const maskedTo = msg.to.replace(/(.{3}).+@/, '$1***@')
    this.logger.info({ to: maskedTo, subject: msg.subject }, 'SMTP: attempting sendMail')
    try {
      await this.transporter!.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      })
      this.logger.info({ to: maskedTo, subject: msg.subject, durationMs: Date.now() - start }, 'SMTP: email sent')
      return { success: true }
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { code?: string; responseCode?: number; response?: string }
      this.logger.error(
        {
          to: maskedTo,
          errorCode: e.code,
          smtpResponse: e.response,
          smtpResponseCode: e.responseCode,
          message: e.message,
          durationMs: Date.now() - start,
        },
        'SMTP: email send failed',
      )
      return { success: false }
    }
  }

  async sendOtp(email: string, otp: string): Promise<{ success: boolean }> {
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
