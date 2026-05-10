import type { JwtPayload } from '@shared/types/auth.types'
import type { Logger } from 'pino'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      log: Logger
      id?: string
    }
  }
}
