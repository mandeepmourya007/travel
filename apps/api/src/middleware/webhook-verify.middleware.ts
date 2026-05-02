import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { AuthError } from '../errors/app-error'
import { logger } from '../utils/logger'

/**
 * Verifies Razorpay webhook signature using HMAC-SHA256.
 *
 * Must run AFTER raw body parser (express.raw) and BEFORE webhook controller.
 * Uses `x-razorpay-signature` header against raw request body.
 *
 * Pattern: Chain of Responsibility (Express middleware pipeline)
 */
export function webhookVerifyMiddleware(webhookSecret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const signature = req.headers['x-razorpay-signature'] as string
    if (!signature) {
      logger.warn('Webhook received without signature header')
      throw new AuthError('Missing x-razorpay-signature header')
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body as Buffer)
      .digest('hex')

    if (expectedSig !== signature) {
      logger.warn('Webhook signature mismatch')
      throw new AuthError('Invalid webhook signature')
    }

    next()
  }
}
