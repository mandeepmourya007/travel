import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { requestIdMiddleware } from './middleware/request-id.middleware'
import { errorHandler } from './middleware/error-handler.middleware'
import { healthRoutes } from './routes/health.routes'
import { logger } from './utils/logger'

export function createServer() {
  const app = express()

  // ── Security ──────────────────────────────────────
  app.use(helmet())
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    }),
  )

  // ── Parsing ───────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

  // ── Compression ───────────────────────────────────
  app.use(compression())

  // ── Request ID (distributed tracing) ──────────────
  app.use(requestIdMiddleware)

  // ── Request Logging ───────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      logger.info(
        {
          requestId: req.headers['x-request-id'],
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        },
        `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      )
    })
    next()
  })

  // ── Health Check (no auth) ────────────────────────
  app.use(healthRoutes)

  // ── API Routes ────────────────────────────────────
  // TODO: Mount feature routes here as they are built
  // app.use('/api/v1/auth', authRoutes)
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
