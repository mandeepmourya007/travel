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
import { authRoutes } from './config/dependencies'
import { authRateLimit } from './middleware/rate-limit.middleware'

export function createServer() {
  const app = express()

  // ── Security ──────────────────────────────────────
  app.use(helmet())
  app.use(cors(corsOptions))

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

  // TODO: Mount feature routes here as they are built
  // app.use('/api/v1/trips', tripRoutes)
  // app.use('/api/v1/bookings', bookingRoutes)
  // app.use('/api/v1/trip-requests', tripRequestRoutes)
  // app.use('/api/v1/destinations', destinationRoutes)
  // app.use('/api/v1/notifications', notificationRoutes)
  // app.use('/api/v1/reviews', reviewRoutes)
  // app.use('/api/v1/uploads', uploadRoutes)

  // ── Error Handler (must be last) ──────────────────
  app.use(errorHandler)

  return app
}
