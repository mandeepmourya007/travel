import { Router } from 'express'
import type { VehicleController } from '../controllers/vehicle.controller'
import type { RequestHandler } from 'express'
import type { UserRole } from '@shared/constants/roles'
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
    requireRole('ORGANIZER'),
    validate(createVehicleSchema),
    controller.createVehicle,
  )

  router.put(
    '/:tripId/vehicle/:vehicleId',
    authMiddleware,
    requireRole('ORGANIZER'),
    validate(updateVehicleSchema),
    controller.updateVehicle,
  )

  router.delete(
    '/:tripId/vehicle/:vehicleId',
    authMiddleware,
    requireRole('ORGANIZER'),
    controller.deleteVehicle,
  )

  router.get(
    '/:tripId/vehicle',
    authMiddleware,
    requireRole('ORGANIZER'),
    controller.getOrganizerSeatMap,
  )

  router.get(
    '/:tripId/vehicles',
    authMiddleware,
    requireRole('ORGANIZER'),
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
