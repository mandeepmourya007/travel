import type { Request, Response } from 'express'
import type { VehicleService } from '../services/vehicle.service'
import { asyncHandler } from '../utils/async-handler'

/**
 * HTTP request handler for vehicle/seat-layout endpoints.
 *
 * Thin controller — parses request, delegates to service, sends response.
 * All business logic lives in VehicleService.
 */
export class VehicleController {
  constructor(private vehicleService: VehicleService) {}

  /** POST /trips/:tripId/vehicle — Create vehicle with seat layout */
  createVehicle = asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params
    const userId = req.user!.userId
    const result = await this.vehicleService.createVehicle(tripId, userId, req.body)
    res.status(201).json({ success: true, data: result })
  })

  /** PUT /trips/:tripId/vehicle/:vehicleId — Update vehicle layout */
  updateVehicle = asyncHandler(async (req: Request, res: Response) => {
    const { tripId, vehicleId } = req.params
    const userId = req.user!.userId
    const result = await this.vehicleService.updateVehicle(tripId, vehicleId, userId, req.body)
    res.json({ success: true, data: result })
  })

  /** DELETE /trips/:tripId/vehicle/:vehicleId — Delete vehicle */
  deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
    const { tripId, vehicleId } = req.params
    const userId = req.user!.userId
    await this.vehicleService.deleteVehicle(tripId, vehicleId, userId)
    res.json({ success: true, data: { message: 'Vehicle deleted' } })
  })

  /** GET /trips/:tripId/vehicle — Get vehicle(s) for trip (organizer view) */
  getOrganizerSeatMap = asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params
    const userId = req.user!.userId
    const result = await this.vehicleService.getOrganizerSeatMap(tripId, userId)
    res.json({ success: true, data: result })
  })

  /** GET /trips/:tripId/vehicles — Get all vehicles for trip (organizer, multi-vehicle) */
  getAllVehicles = asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params
    const userId = req.user!.userId
    const result = await this.vehicleService.getAllVehicles(tripId, userId)
    res.json({ success: true, data: result })
  })

  /** GET /trips/:tripId/seats — Get seat map (traveler view, public) */
  getSeatMap = asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params
    const result = await this.vehicleService.getSeatMap(tripId)
    res.json({ success: true, data: result })
  })

  /** POST /trips/:tripId/seats/hold — Hold seats during booking */
  holdSeats = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { seatIds, bookingId } = req.body
    await this.vehicleService.holdSeats(seatIds, userId, bookingId)
    res.json({ success: true, data: { message: 'Seats held successfully' } })
  })
}
