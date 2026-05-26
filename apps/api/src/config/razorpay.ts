import Razorpay from 'razorpay'
import { logger } from '../utils/logger'
import { env } from './env'

function createRazorpayClient(): Razorpay | null {
  const keyId = env.RAZORPAY_KEY_ID
  const keySecret = env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    logger.warn('Razorpay not configured — payment features disabled')
    return null
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

export const razorpayClient = createRazorpayClient()

/** Check if Razorpay is configured before using payment features */
export function isRazorpayConfigured(): boolean {
  return razorpayClient !== null
}
