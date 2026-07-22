import { Request, Response, NextFunction } from 'express'
import { UserRepository } from '../repositories/user.repository'
import { AuthError, ForbiddenError, NotFoundError } from '../errors/app-error'
import { AUTH_ERROR_CODE } from '@shared/constants'

/**
 * Server-side enforcement of mandatory phone verification.
 *
 * `req.user.phoneVerified` (if present at all) comes from a short-lived (15 min)
 * JWT claim that is NOT refreshed when a user completes phone verification, so
 * it can be stale for the lifetime of the access token. This middleware always
 * does a fresh DB read via UserRepository rather than trusting anything on
 * req.user. Must run after authMiddleware.
 */
export function createRequirePhoneVerified(userRepo: UserRepository) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthError('Not authenticated'))
    }

    userRepo
      .findById(req.user.userId)
      .then((user) => {
        if (!user) {
          return next(new NotFoundError('User'))
        }
        if (!user.phoneVerified) {
          return next(new ForbiddenError('Phone verification required', AUTH_ERROR_CODE.PHONE_NOT_VERIFIED))
        }
        next()
      })
      .catch(next)
  }
}
