import { createServer as createHttpServer } from 'http'
import { createServer } from './server'
import { logger } from './utils/logger'
import { redis } from './config/redis'
import { basePrisma } from './lib/prisma'
import { startCronJobs } from './utils/cron-jobs'
import { cronDeps, authService, chatService } from './config/dependencies'
import { createSocketServer } from './socket'
import { env } from './config/env'

const PORT = process.env.PORT || 4000

const app = createServer()
const httpServer = createHttpServer(app)

// ── Socket.IO ─────────────────────────────────────────
const corsOrigins = [env.CLIENT_URL]
if (env.NODE_ENV === 'development') {
  corsOrigins.push('http://localhost:3000')
}
createSocketServer(httpServer, authService, chatService, corsOrigins)

const server = httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Health check: http://localhost:${PORT}/health`)
})

// ── Background Jobs ───────────────────────────────────
const stopCrons = startCronJobs(cronDeps)

// ── Graceful Shutdown ─────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received — cleaning up')
  stopCrons()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (redis) await redis.quit().catch(() => {})
  await basePrisma.$disconnect().catch(() => {})
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
