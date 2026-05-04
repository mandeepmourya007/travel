import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { redis } from '../config/redis'

const router = Router()

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const checks: Record<string, 'up' | 'down'> = {}

    // DB check
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = 'up'
    } catch {
      checks.database = 'down'
    }

    // Redis check (optional dependency)
    if (redis) {
      try {
        await redis.ping()
        checks.redis = 'up'
      } catch {
        checks.redis = 'down'
      }
    } else {
      checks.redis = 'down'
    }

    const isHealthy = checks.database === 'up'
    const status = isHealthy
      ? checks.redis === 'up' ? 'healthy' : 'degraded'
      : 'unhealthy'

    res.status(isHealthy ? 200 : 503).json({
      status,
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() })
  }
})

export { router as healthRoutes }
