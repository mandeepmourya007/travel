import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import { AuthError } from '../errors/app-error'
import { requestContext } from '../utils/request-context'

export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization
      if (!header || !header.startsWith('Bearer ')) {
        throw new AuthError('Missing or invalid authorization header')
      }

      const token = header.split(' ')[1]
      const payload = authService.verifyAccessToken(token)
      req.user = payload

      // Enrich ALS store with user context so getLogger() includes userId/role
      const store = requestContext.getStore()
      if (store) {
        store.userId = payload.userId
        store.role = payload.role
        store.logger = req.log.child({ userId: payload.userId, role: payload.role })
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}
