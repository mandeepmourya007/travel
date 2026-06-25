import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { OtpController } from '../controllers/otp.controller'
import { validate } from '../middleware/validate.middleware'
import { signupSchema, loginSchema, sendOtpSchema, verifyOtpSchema, sendEmailOtpSchema, verifyEmailOtpSchema, updateProfileSchema, googleAuthSchema, updateOrganizerProfileSchema, connectBankAccountSchema, organizerInviteSchema, organizerSignupSchema } from '@shared/validators/auth.schema'
import { addDocCommentSchema } from '@shared/validators/admin.schema'
import { otpRateLimit, authRateLimit } from '../middleware/rate-limit.middleware'
import { USER_ROLE } from '@shared/constants'

export function createAuthRoutes(
  authController: AuthController,
  otpController: OtpController,
  authMiddleware: ReturnType<typeof import('../middleware/auth.middleware').createAuthMiddleware>,
  requireRole: typeof import('../middleware/role.middleware').requireRole,
) {
  const router = Router()

  router.get('/signup/:token', authController.getOrganizerInviteInfo)
  router.post('/signup/:token', authRateLimit, validate(organizerSignupSchema), authController.organizerSignup)
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
    requireRole(USER_ROLE.ORGANIZER),
    validate(updateOrganizerProfileSchema),
    authController.updateOrganizerProfile,
  )

  router.post(
    '/profile/organizer/bank',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(connectBankAccountSchema),
    authController.connectBankAccount,
  )

  router.post(
    '/profile/organizer/doc-comments',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(addDocCommentSchema),
    authController.addOrganizerDocComment,
  )

  router.get(
    '/profile/organizer/doc-comments',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    authController.getOrganizerDocComments,
  )

  router.post(
    '/organizer-invite',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    validate(organizerInviteSchema),
    authController.generateOrganizerInvite,
  )

  router.post('/google', validate(googleAuthSchema), authController.googleAuth)

  router.post('/otp/send', otpRateLimit, validate(sendOtpSchema), otpController.sendOtp)
  router.post('/otp/verify', otpRateLimit, validate(verifyOtpSchema), otpController.verifyOtp)

  router.post('/otp/email/send', otpRateLimit, validate(sendEmailOtpSchema), otpController.sendEmailOtp)
  router.post('/otp/email/verify', otpRateLimit, validate(verifyEmailOtpSchema), otpController.verifyEmailOtp)

  return router
}
