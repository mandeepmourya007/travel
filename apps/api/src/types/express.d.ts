import type { JwtPayload } from '@shared/types/auth.types'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}
