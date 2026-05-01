import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { validate } from '../middleware/validate.middleware'
import { signupSchema, loginSchema } from '@shared/validators/auth.schema'

export function createAuthRoutes(
  authController: AuthController,
  authMiddleware: ReturnType<typeof import('../middleware/auth.middleware').createAuthMiddleware>,
) {
  const router = Router()

  router.post('/signup', validate(signupSchema), authController.signup)
  router.post('/login', validate(loginSchema), authController.login)
  router.post('/refresh', authController.refresh)
  router.post('/logout', authController.logout)
  router.post('/logout-all', authMiddleware, authController.logoutAll)
  router.get('/me', authMiddleware, authController.getMe)

  return router
}
