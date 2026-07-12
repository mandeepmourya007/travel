export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
  /** Overrides the provider's default reply-to address for this message. */
  replyTo?: string
  /** Extra headers merged on top of the provider's defaults (e.g. List-Unsubscribe). */
  headers?: Record<string, string>
}

/** Result of a send attempt. `error` is populated on failure so callers can
 *  attach it as the `cause` of the AppError they throw — without it, the real
 *  provider failure (bad domain, rate limit, SMTP auth, etc.) is silently
 *  dropped and never reaches Sentry, leaving every failure undiagnosable. */
export interface EmailSendResult {
  success: boolean
  error?: unknown
}

/** Generic email transport — reusable for OTP, booking confirmations, trip updates, etc. */
export interface IEmailProvider {
  /** Send any email. Returns delivery status. */
  sendEmail(msg: EmailMessage): Promise<EmailSendResult>

  /** Convenience: send OTP with pre-formatted template. */
  sendOtp(email: string, otp: string): Promise<EmailSendResult>
}
