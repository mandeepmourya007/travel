import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { OtpController } from '../controllers/otp.controller'
import { validate } from '../middleware/validate.middleware'
import { signupSchema, loginSchema, sendOtpSchema, verifyOtpSchema, sendEmailOtpSchema, verifyEmailOtpSchema, updateProfileSchema, googleAuthSchema, updateOrganizerProfileSchema, connectBankAccountSchema } from '@shared/validators/auth.schema'
import { otpRateLimit } from '../middleware/rate-limit.middleware'

export function createAuthRoutes(
  authController: AuthController,
  otpController: OtpController,
  authMiddleware: ReturnType<typeof import('../middleware/auth.middleware').createAuthMiddleware>,
  requireRole: typeof import('../middleware/role.middleware').requireRole,
) {
  const router = Router()

  router.post('/signup', validate(signupSchema), authController.signup)
  router.post('/login', validate(loginSchema), authController.login)
  router.post('/refresh', authController.refresh)
  router.post('/logout', authController.logout)
  router.post('/logout-all', authMiddleware, authController.logoutAll)
  router.get('/me', authMiddleware, authController.getMe)
  router.patch('/profile', authMiddleware, validate(updateProfileSchema), authController.updateProfile)
  router.get('/profile', authMiddleware, authController.getFullProfile)
  router.patch(
    '/profile/organizer',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(updateOrganizerProfileSchema),
    authController.updateOrganizerProfile,
  )

  router.post(
    '/profile/organizer/bank',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(connectBankAccountSchema),
    authController.connectBankAccount,
  )

  router.post('/google', validate(googleAuthSchema), authController.googleAuth)

  router.post('/otp/send', otpRateLimit, validate(sendOtpSchema), otpController.sendOtp)
  router.post('/otp/verify', otpRateLimit, validate(verifyOtpSchema), otpController.verifyOtp)

  router.post('/otp/email/send', otpRateLimit, validate(sendEmailOtpSchema), otpController.sendEmailOtp)
  router.post('/otp/email/verify', otpRateLimit, validate(verifyEmailOtpSchema), otpController.verifyEmailOtp)

  return router
}
