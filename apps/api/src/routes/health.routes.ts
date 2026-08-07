import crypto from 'crypto'
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { redis } from '../config/redis'
import { env } from '../config/env'
import { NotFoundError } from '../errors/app-error'
import { healthReadyRateLimit } from '../middleware/rate-limit.middleware'
import type { HealthController } from '../controllers/health.controller'

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

/**
 * Guard for GET /api/v1/health/ready — a shared-secret header check (not admin JWT,
 * since CI/monitoring must be able to call it without logging in). Pings paid third
 * parties, so it must never be reachable as an open, unauthenticated oracle:
 *
 * - HEALTH_CHECK_TOKEN unset (default)      → always 404, route is effectively inert.
 * - HEALTH_CHECK_TOKEN set, header missing
 *   or mismatched                           → 404 (not 401 — a differentiated status
 *                                              would let a scanner distinguish "route
 *                                              exists, bad token" from "route doesn't
 *                                              exist" and enumerate tokens). Note this
 *                                              is only indistinguishable from OTHER
 *                                              protected JSON-erroring routes — there is
 *                                              no global catch-all 404 handler in
 *                                              server.ts, so a truly unmatched path still
 *                                              falls through to Express's default HTML 404.
 * - HEALTH_CHECK_TOKEN set, header matches   → next().
 */
function requireHealthToken(req: Request, _res: Response, next: NextFunction): void {
  const configuredToken = env.HEALTH_CHECK_TOKEN
  if (!configuredToken) {
    next(new NotFoundError('Route'))
    return
  }

  const providedToken = req.header('x-health-token')
  if (!providedToken || !timingSafeStringEqual(providedToken, configuredToken)) {
    next(new NotFoundError('Route'))
    return
  }

  next()
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Sibling route to GET /health — deliberately separate so the cheap, unauthenticated
 * DB+Redis check above stays untouched. Mounted under /api/v1/health in server.ts
 * (unlike /health, which is mounted unprefixed for Render's keep-alive cron).
 */
export function createHealthReadyRoutes(healthController: HealthController): Router {
  const readyRouter = Router()
  // healthReadyRateLimit before the token guard: each hit fans out to 4 real outbound
  // provider calls, so the abuse-sensitive tier must apply regardless of token validity.
  readyRouter.get('/ready', healthReadyRateLimit, requireHealthToken, healthController.ready)
  return readyRouter
}
