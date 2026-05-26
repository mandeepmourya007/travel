import { createServer as createHttpServer } from 'http'
import { createServer } from './server'
import { logger } from './utils/logger'
import { redis } from './config/redis'
import { basePrisma } from './lib/prisma'
import { startCronJobs } from './utils/cron-jobs'
import { cronDeps, authService, chatService, setIoInstance } from './config/dependencies'
import { createSocketServer } from './socket'
import { env } from './config/env'

const PORT = env.PORT

const app = createServer()
const httpServer = createHttpServer(app)

// ── Socket.IO ─────────────────────────────────────────
const corsOrigins = [env.CLIENT_URL]
if (env.NODE_ENV === 'development') {
  corsOrigins.push('http://localhost:3000')
}
const io = createSocketServer(httpServer, authService, chatService, corsOrigins)
setIoInstance(io)

const server = httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Health check: http://localhost:${PORT}/health`)
})

// ── Background Jobs ───────────────────────────────────
const stopCrons = startCronJobs(cronDeps)

// ── Graceful Shutdown ─────────────────────────────────
const SHUTDOWN_TIMEOUT_MS = 5000

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received — cleaning up')

  const forceExit = setTimeout(() => {
    logger.warn('Graceful shutdown timed out — forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  forceExit.unref()

  stopCrons()
  io.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (redis) await redis.quit().catch(() => {})
  await basePrisma.$disconnect().catch(() => {})
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down')
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down')
  process.exit(1)
})
