import cors from 'cors'
import { env } from './env'

const origins = new Set([env.CLIENT_URL])
if (env.ALLOWED_ORIGINS) {
  env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean).forEach(o => origins.add(o))
}
if (env.NODE_ENV === 'development') {
  origins.add('http://localhost:3000')
  origins.add('http://localhost:3001')
}
const allowedOrigins = [...origins]

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400,
}
