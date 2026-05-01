import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import { AuthError } from '../errors/app-error'

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
      next()
    } catch (err) {
      next(err)
    }
  }
}
