import cors from 'cors'
import { env } from './env'
import { logger } from '../utils/logger'

const origins = new Set([env.CLIENT_URL])
if (env.ALLOWED_ORIGINS) {
  env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean).forEach(o => origins.add(o))
}
if (env.NODE_ENV === 'development') {
  origins.add('http://localhost:3000')
  origins.add('http://localhost:3001')
}
const allowedOrigins = [...origins]

// Log at startup so we can confirm exactly which origins are loaded
logger.info({ allowedOrigins }, 'CORS allowed origins')

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      logger.warn({ blockedOrigin: origin, allowedOrigins }, 'CORS blocked')
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'baggage', 'sentry-trace'],
  maxAge: 86400,
}
