import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { ResellerController } from '../controllers/reseller.controller'
import { validate } from '../middleware/validate.middleware'
import {
  createMainLinkSchema,
  mainLinkFiltersSchema,
  createSublinkSchema,
  patchSublinkSchema,
  sublinkFiltersSchema,
  leadsFiltersSchema,
  sublinkTokenParamSchema,
  recordAttributionSchema,
  resellerSearchQuerySchema,
  organizerSearchQuerySchema,
  myMainLinksFiltersSchema,
} from '@shared/validators/reseller.schema'
import { paginationSchema, mainLinkIdParamSchema, sublinkIdParamSchema } from '@shared/validators/common.schema'
import { USER_ROLE } from '@shared/constants'
import { generalRateLimit } from '../middleware/rate-limit.middleware'

export function createResellerRoutes(
  resellerController: ResellerController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // ─── Organizer: main links (static before /:mainLinkId) ─────
  router.post(
    '/main-links',
    generalRateLimit,
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(createMainLinkSchema),
    resellerController.createMainLink,
  )

  router.get(
    '/main-links',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(mainLinkFiltersSchema, 'query'),
    resellerController.listMainLinks,
  )

  router.get(
    '/leads',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(leadsFiltersSchema, 'query'),
    resellerController.getOrganizerLeads,
  )

  router.get(
    '/main-links/:mainLinkId/bookings',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(mainLinkIdParamSchema, 'params'),
    validate(paginationSchema, 'query'),
    resellerController.getMainLinkBookings,
  )

  // ─── Reseller: main links shared with them ────────────────────
  // isReseller gating happens in ResellerService, NOT here — requireRole can't
  // express it since a reseller shares the TRAVELER role. Static path segment
  // ("mine"), no collision with the organizer's PATCH/GET-bookings :mainLinkId
  // routes above (different methods/segment counts).
  router.get(
    '/main-links/mine',
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER, USER_ROLE.ADMIN),
    validate(myMainLinksFiltersSchema, 'query'),
    resellerController.getMyMainLinks,
  )

  // ─── Reseller: sublinks (static before /:sublinkId) ──────────
  // isReseller gating happens in ResellerService, NOT here — requireRole can't
  // express it since a reseller shares the TRAVELER role.
  router.post(
    '/sublinks',
    generalRateLimit,
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER, USER_ROLE.ADMIN),
    validate(createSublinkSchema),
    resellerController.createSublink,
  )

  router.get(
    '/sublinks',
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER, USER_ROLE.ADMIN),
    validate(sublinkFiltersSchema, 'query'),
    resellerController.listSublinks,
  )

  router.get(
    '/my-leads',
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER, USER_ROLE.ADMIN),
    validate(leadsFiltersSchema, 'query'),
    resellerController.getMyLeads,
  )

  router.get(
    '/sublinks/resolve/:token',
    generalRateLimit,
    validate(sublinkTokenParamSchema, 'params'),
    resellerController.resolveSublink,
  )

  // Allows ORGANIZER in addition to TRAVELER/ADMIN: the shared "Views" UI on
  // both the organizer dashboard and the reseller/admin views calls this same
  // sublink-level endpoint. ResellerService.getSublinkBookings does the actual
  // ownership check (organizer must own the sublink's parent main link).
  router.get(
    '/sublinks/:sublinkId/bookings',
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER, USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(sublinkIdParamSchema, 'params'),
    validate(paginationSchema, 'query'),
    resellerController.getSublinkBookings,
  )

  router.patch(
    '/sublinks/:sublinkId',
    authMiddleware,
    requireRole(USER_ROLE.TRAVELER, USER_ROLE.ADMIN),
    validate(sublinkIdParamSchema, 'params'),
    validate(patchSublinkSchema),
    resellerController.patchSublink,
  )

  // ─── Attribution (any authenticated user) ─────────────────────
  router.post(
    '/attribution',
    generalRateLimit,
    authMiddleware,
    validate(recordAttributionSchema),
    resellerController.recordAttribution,
  )

  // ─── Combobox search ───────────────────────────────────────────
  router.get(
    '/resellers/search',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER, USER_ROLE.ADMIN),
    validate(resellerSearchQuerySchema, 'query'),
    resellerController.searchResellers,
  )

  router.get(
    '/organizers/search',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    validate(organizerSearchQuerySchema, 'query'),
    resellerController.searchOrganizers,
  )

  // ─── Admin ───────────────────────────────────────────────────
  router.get(
    '/admin/leads',
    authMiddleware,
    requireRole(USER_ROLE.ADMIN),
    validate(leadsFiltersSchema, 'query'),
    resellerController.getAdminLeads,
  )

  return router
}
