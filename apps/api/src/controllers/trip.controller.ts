import { Request, Response } from 'express'
import type { TripFilters } from '@shared/types/trip.types'
import { asyncHandler } from '../utils/async-handler'
import { TripService } from '../services/trip.service'

export class TripController {
  constructor(private tripService: TripService) {}

  search = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.searchTrips(req.query as unknown as TripFilters)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.getTripBySlug(req.params.slug)
    res.json({ success: true, data: trip })
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.getTripById(req.params.id)
    res.json({ success: true, data: trip })
  })

  getMyTrips = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined
    const trips = await this.tripService.getMyTrips(req.user!.userId, status)
    res.json({ success: true, data: trips })
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.createTrip(req.user!.userId, req.body)
    res.status(201).json({ success: true, data: trip })
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.updateTrip(req.user!.userId, req.params.id, req.body)
    res.json({ success: true, data: trip })
  })

  publish = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.publishTrip(req.user!.userId, req.params.id)
    res.json({ success: true, data: trip })
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.tripService.deleteTrip(req.user!.userId, req.params.id)
    res.json({ success: true, message: 'Trip deleted' })
  })
}
