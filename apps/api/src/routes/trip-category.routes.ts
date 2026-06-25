import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/types/user.types'
import { USER_ROLE } from '@shared/constants'
import type { TripCategoryController } from '../controllers/trip-category.controller'
import { validate } from '../middleware/validate.middleware'
import {
  createTripCategorySchema,
  updateTripCategorySchema,
  createTripTypeRequestSchema,
  reviewTripTypeRequestSchema,
  tripTypeRequestFiltersSchema,
} from '@shared/validators/trip-category.schema'

/** Public route: GET /trip-categories */
export function createPublicTripCategoryRoutes(controller: TripCategoryController) {
  const router = Router()
  router.get('/', controller.getActiveCategories)
  return router
}

/** Admin routes: mounted under /admin/trip-categories and /admin/trip-type-requests */
export function createAdminTripCategoryRoutes(
  controller: TripCategoryController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()
  router.use(authMiddleware, requireRole(USER_ROLE.ADMIN))

  // ─── Category CRUD ────────────────────────────────────
  router.get('/trip-categories', controller.getAllCategories)

  router.post(
    '/trip-categories',
    validate(createTripCategorySchema, 'body'),
    controller.createCategory,
  )

  router.put(
    '/trip-categories/:id',
    validate(updateTripCategorySchema, 'body'),
    controller.updateCategory,
  )

  router.delete('/trip-categories/:id', controller.deleteCategory)

  // ─── Request Review ───────────────────────────────────
  router.get(
    '/trip-type-requests',
    validate(tripTypeRequestFiltersSchema, 'query'),
    controller.getRequests,
  )

  router.patch(
    '/trip-type-requests/:id',
    validate(reviewTripTypeRequestSchema, 'body'),
    controller.reviewRequest,
  )

  return router
}

/** Organizer routes: mounted under /trip-type-requests */
export function createOrganizerTripTypeRequestRoutes(
  controller: TripCategoryController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()
  router.use(authMiddleware, requireRole(USER_ROLE.ORGANIZER))

  router.post(
    '/',
    validate(createTripTypeRequestSchema, 'body'),
    controller.submitRequest,
  )

  router.get('/my', controller.getMyRequests)

  return router
}
