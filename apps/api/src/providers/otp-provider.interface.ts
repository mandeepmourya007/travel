/** Adapter pattern — swap SMS provider without changing OtpService. */
export interface IOtpProvider {
  sendOtp(phone: string, otp: string): Promise<{ success: boolean; channel: 'sms' | 'whatsapp' }>
}
