import { Router } from 'express'
import type { VehicleController } from '../controllers/vehicle.controller'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/constants/roles'
import { USER_ROLE } from '@shared/constants'
import { validate } from '../middleware/validate.middleware'
import { createVehicleSchema, updateVehicleSchema, selectSeatsSchema } from '@shared/validators'

/**
 * Creates vehicle/seat-layout routes.
 *
 * Mounted at /api/v1/trips (nested under trip routes).
 * Organizer endpoints require auth + ORGANIZER role.
 * Traveler endpoints require auth only.
 */
export function createVehicleRoutes(
  controller: VehicleController,
  authMiddleware: RequestHandler,
  requireRole: (...roles: UserRole[]) => RequestHandler,
) {
  const router = Router()

  // ── Organizer Routes ──────────────────────────────
  router.post(
    '/:tripId/vehicle',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(createVehicleSchema),
    controller.createVehicle,
  )

  router.put(
    '/:tripId/vehicle/:vehicleId',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    validate(updateVehicleSchema),
    controller.updateVehicle,
  )

  router.delete(
    '/:tripId/vehicle/:vehicleId',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    controller.deleteVehicle,
  )

  router.get(
    '/:tripId/vehicle',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    controller.getOrganizerSeatMap,
  )

  router.get(
    '/:tripId/vehicles',
    authMiddleware,
    requireRole(USER_ROLE.ORGANIZER),
    controller.getAllVehicles,
  )

  // ── Traveler Routes ───────────────────────────────
  router.get(
    '/:tripId/seats',
    controller.getSeatMap,
  )

  router.post(
    '/:tripId/seats/hold',
    authMiddleware,
    validate(selectSeatsSchema),
    controller.holdSeats,
  )

  return router
}
