import { Request, Response, NextFunction } from 'express'
import { AuthError, ForbiddenError } from '../errors/app-error'
import type { UserRole } from '@shared/types/user.types'

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthError('Not authenticated')
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions')
    }
    next()
  }
}
