import { Router } from 'express'
import type { RequestHandler } from 'express'
import { OrganizerLeadController } from '../controllers/organizer-lead.controller'
import { validate } from '../middleware/validate.middleware'
import { leadRateLimit } from '../middleware/rate-limit.middleware'
import {
  createOrganizerLeadSchema,
  updateOrganizerLeadStatusSchema,
  organizerLeadFiltersSchema,
} from '@shared/validators/organizer-lead.schema'
import { cuidParamSchema } from '@shared/validators/common.schema'
import { USER_ROLE } from '@shared/constants'
import type { UserRole } from '@shared/types/user.types'

export function createPublicOrganizerLeadRoutes(controller: OrganizerLeadController) {
  const router = Router()

  // Public — CTA on home page ("Are you a trip organizer?")
  router.post('/', leadRateLimit, validate(createOrganizerLeadSchema), controller.submit)

  return router
}

export function createAdminOrganizerLeadRoutes(
  controller: OrganizerLeadController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  router.use(authMiddleware, requireRole(USER_ROLE.ADMIN))

  router.get('/', validate(organizerLeadFiltersSchema, 'query'), controller.list)
  router.patch(
    '/:id',
    validate(cuidParamSchema, 'params'),
    validate(updateOrganizerLeadStatusSchema),
    controller.updateStatus,
  )

  return router
}
