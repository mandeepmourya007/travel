import * as Sentry from '@sentry/node'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { corsOptions } from './config/cors'
import { pinoHttpMiddleware } from './middleware/pino-http.middleware'
import { generalRateLimit } from './middleware/rate-limit.middleware'
import { errorHandler } from './middleware/error-handler.middleware'
import { asyncHandler } from './utils/async-handler'
import { healthRoutes } from './routes/health.routes'
import { authRoutes, firebaseAuthRoutes, destinationRoutes, tripRoutes, uploadRoutes, bookingRoutes, paymentRoutes, reviewRoutes, walletRoutes, chatRoutes, notificationRoutes, adminRoutes, vehicleRoutes, webhookRoutes, publicTripCategoryRoutes, adminTripCategoryRoutes, organizerTripTypeRequestRoutes, sitemapService } from './config/dependencies'
import { authRateLimit } from './middleware/rate-limit.middleware'

export function createServer() {
  const app = express()

  // ── Trust Nginx reverse proxy (production) ────────
  // Without this, req.ip returns Nginx container IP for ALL requests,
  // breaking rate limiting, request logging, and any IP-based logic.
  // "1" = trust the first proxy hop (Nginx).
  app.set('trust proxy', 1)

  // ── Security ──────────────────────────────────────
  app.use(helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }))
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)')
    next()
  })
  app.use(cors(corsOptions))

  // ── Webhook Routes (raw body — MUST be before JSON parser) ──
  if (webhookRoutes) {
    app.use('/api/v1/webhooks', webhookRoutes)
  }

  // ── Parsing ───────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

  // ── Compression ───────────────────────────────────
  app.use(compression())

  // ── Request Logging + ID (pino-http + AsyncLocalStorage) ──
  app.use(pinoHttpMiddleware)

  // ── Rate Limiting (Redis-backed) ──────────────────
  app.use(generalRateLimit)

  // ── Health Check (no auth) ────────────────────────
  app.use(healthRoutes)

  // ── API Routes ────────────────────────────────────
  app.use('/api/v1/auth', authRateLimit, authRoutes)
  if (firebaseAuthRoutes) {
    app.use('/api/v1/auth', firebaseAuthRoutes)
  }
  app.use('/api/v1/destinations', destinationRoutes)
  app.use('/api/v1/trips', tripRoutes)
  app.use('/api/v1/trips', vehicleRoutes)

  app.use('/api/v1/uploads', uploadRoutes)
  app.use('/api/v1/bookings', bookingRoutes)
  app.use('/api/v1/payments', paymentRoutes)
  app.use('/api/v1/wallet', walletRoutes)
  app.use('/api/v1/reviews', reviewRoutes)
  app.use('/api/v1/chat', chatRoutes)
  app.use('/api/v1/notifications', notificationRoutes)
  app.use('/api/v1/admin', adminRoutes)
  app.use('/api/v1/admin', adminTripCategoryRoutes)
  app.use('/api/v1/trip-categories', publicTripCategoryRoutes)
  app.use('/api/v1/trip-type-requests', organizerTripTypeRequestRoutes)

  // ── Sitemap Data (lightweight, no auth) ──────────
  app.get('/api/v1/sitemap-data', asyncHandler(async (_req, res) => {
    const data = await sitemapService.getSitemapData()
    res.json({ success: true, data })
  }))

  // ── Sentry Error Handler (after all routes, before custom errorHandler) ──
  // Captures unhandled errors and attaches them to the active trace span.
  Sentry.setupExpressErrorHandler(app)

  // ── Error Handler (must be last) ──────────────────
  app.use(errorHandler)

  return app
}
