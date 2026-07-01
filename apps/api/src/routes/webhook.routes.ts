import { Router } from 'express'
import express from 'express'
import { WebhookController } from '../controllers/webhook.controller'
import { webhookRateLimit } from '../middleware/rate-limit.middleware'

/**
 * Webhook routes — mounted BEFORE JSON body parser in server.ts.
 *
 * Middleware chain:
 * 1. express.raw() — preserves raw Buffer for HMAC verification in the gateway
 * 2. webhookRateLimiter — separate rate limit tier for webhooks
 * 3. WebhookController — gateway verifies sig + records event + async processing
 *
 * Signature verification is done INSIDE each gateway's verifyAndParseWebhook() because
 * Razorpay and Cashfree use different HMAC schemes:
 * - Razorpay: HMAC-SHA256(rawBody, secret) → hex → x-razorpay-signature
 * - Cashfree:  HMAC-SHA256(timestamp+rawBody, secret) → base64 → x-webhook-signature
 *
 * Pattern: Chain of Responsibility
 */
export function createWebhookRoutes(
  controller: WebhookController,
  razorpayWebhookSecret: string,
  cashfreeWebhookSecret: string,
) {
  const router = Router()

  if (razorpayWebhookSecret) {
    router.post(
      '/razorpay',
      express.raw({ type: 'application/json' }),
      webhookRateLimit,
      controller.handleRazorpay,
    )
  }

  if (cashfreeWebhookSecret) {
    router.post(
      '/cashfree',
      express.raw({ type: 'application/json' }),
      webhookRateLimit,
      controller.handleCashfree,
    )
  }

  return router
}
