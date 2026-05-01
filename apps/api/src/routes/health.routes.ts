import { Router, Request, Response } from 'express'

const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

export { router as healthRoutes }
