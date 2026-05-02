import { Router } from 'express'
import { UploadController } from '../controllers/upload.controller'
import { validate } from '../middleware/validate.middleware'
import { uploadSignatureSchema } from '@shared/validators/upload.schema'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'

export function createUploadRoutes(
  uploadController: UploadController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  router.post(
    '/signature',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(uploadSignatureSchema),
    uploadController.getSignature,
  )

  return router
}
