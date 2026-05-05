import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { corsOptions } from './config/cors'
import { requestIdMiddleware } from './middleware/request-id.middleware'
import { requestLoggerMiddleware } from './middleware/request-logger.middleware'
import { generalRateLimit } from './middleware/rate-limit.middleware'
import { errorHandler } from './middleware/error-handler.middleware'
import { healthRoutes } from './routes/health.routes'
import { authRoutes, firebaseAuthRoutes, destinationRoutes, tripRoutes, uploadRoutes, bookingRoutes, paymentRoutes, reviewRoutes, walletRoutes, webhookRoutes } from './config/dependencies'
import { authRateLimit } from './middleware/rate-limit.middleware'

export function createServer() {
  const app = express()

  // ── Trust Nginx reverse proxy (production) ────────
  // Without this, req.ip returns Nginx container IP for ALL requests,
  // breaking rate limiting, request logging, and any IP-based logic.
  // "1" = trust the first proxy hop (Nginx).
  app.set('trust proxy', 1)

  // ── Security ──────────────────────────────────────
  app.use(helmet())
  app.use(cors(corsOptions))

  // ── Webhook Routes (raw body — MUST be before JSON parser) ──
  if (webhookRoutes) {
    app.use('/api/v1/webhooks', webhookRoutes)
  }

  // ── Parsing ───────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

  // ── Compression ───────────────────────────────────
  app.use(compression())

  // ── Request ID (distributed tracing) ──────────────
  app.use(requestIdMiddleware)

  // ── Rate Limiting (Redis-backed) ──────────────────
  app.use(generalRateLimit)

  // ── Request Logging ───────────────────────────────
  app.use(requestLoggerMiddleware)

  // ── Health Check (no auth) ────────────────────────
  app.use(healthRoutes)

  // ── API Routes ────────────────────────────────────
  app.use('/api/v1/auth', authRateLimit, authRoutes)
  if (firebaseAuthRoutes) {
    app.use('/api/v1/auth', firebaseAuthRoutes)
  }
  app.use('/api/v1/destinations', destinationRoutes)
  app.use('/api/v1/trips', tripRoutes)

  app.use('/api/v1/uploads', uploadRoutes)
  app.use('/api/v1/bookings', bookingRoutes)
  app.use('/api/v1/payments', paymentRoutes)
  app.use('/api/v1/wallet', walletRoutes)
  app.use('/api/v1/reviews', reviewRoutes)

  // TODO: Mount feature routes here as they are built
  // app.use('/api/v1/trip-requests', tripRequestRoutes)
  // app.use('/api/v1/notifications', notificationRoutes)

  // ── Error Handler (must be last) ──────────────────
  app.use(errorHandler)

  return app
}
