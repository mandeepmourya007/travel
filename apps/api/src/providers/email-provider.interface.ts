export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
}

/** Generic email transport — reusable for OTP, booking confirmations, trip updates, etc. */
export interface IEmailProvider {
  /** Send any email. Returns delivery status. */
  sendEmail(msg: EmailMessage): Promise<{ success: boolean }>

  /** Convenience: send OTP with pre-formatted template. */
  sendOtp(email: string, otp: string): Promise<{ success: boolean }>
}
