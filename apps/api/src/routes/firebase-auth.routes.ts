import { Router } from 'express'
import { FirebaseAuthController } from '../controllers/firebase-auth.controller'
import { validate } from '../middleware/validate.middleware'
import { firebaseVerifySchema } from '@shared/validators/auth.schema'
import { authRateLimit } from '../middleware/rate-limit.middleware'

export function createFirebaseAuthRoutes(firebaseAuthController: FirebaseAuthController) {
  const router = Router()

  router.post('/firebase/verify', authRateLimit, validate(firebaseVerifySchema), firebaseAuthController.verifyPhone)

  return router
}
