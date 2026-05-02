import { Router } from 'express'
import express from 'express'
import { WebhookController } from '../controllers/webhook.controller'
import { webhookVerifyMiddleware } from '../middleware/webhook-verify.middleware'
import { webhookRateLimit } from '../middleware/rate-limit.middleware'

/**
 * Webhook routes — mounted BEFORE JSON body parser in server.ts.
 *
 * Middleware chain (C5 fix):
 * 1. express.raw() — preserves raw Buffer for HMAC verification
 * 2. webhookRateLimiter — separate rate limit tier for webhooks
 * 3. webhookVerifyMiddleware — HMAC-SHA256 signature verification
 * 4. WebhookController — records event + async processing
 *
 * Pattern: Chain of Responsibility
 */
export function createWebhookRoutes(
  controller: WebhookController,
  webhookSecret: string,
) {
  const router = Router()

  router.post(
    '/razorpay',
    express.raw({ type: 'application/json' }),
    webhookRateLimit,
    webhookVerifyMiddleware(webhookSecret),
    controller.handleRazorpay,
  )

  return router
}
