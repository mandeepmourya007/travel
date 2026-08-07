import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { HealthService } from '../services/health.service'

export class HealthController {
  constructor(private healthService: HealthService) {}

  /** GET /api/v1/health/ready — guarded deep readiness probe (see health.routes.ts for the guard). */
  ready = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.healthService.getReadiness()
    res.status(result.status === 'healthy' ? 200 : 503).json(result)
  })
}
