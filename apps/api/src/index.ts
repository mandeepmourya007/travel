import { createServer } from './server'
import { logger } from './utils/logger'
import { redis } from './config/redis'
import { basePrisma } from './lib/prisma'

const PORT = process.env.PORT || 4000

const app = createServer()

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Health check: http://localhost:${PORT}/health`)
})

// ── Graceful Shutdown ─────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received — cleaning up')
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (redis) await redis.quit().catch(() => {})
  await basePrisma.$disconnect().catch(() => {})
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
