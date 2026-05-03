import { Request, Response } from 'express'
import type { TripFilters } from '@shared/types/trip.types'
import { tripBookingFiltersSchema, tripRequestFiltersSchema } from '@shared/validators/booking.schema'
import { asyncHandler } from '../utils/async-handler'
import { TripService } from '../services/trip.service'

export class TripController {
  constructor(private tripService: TripService) {}

  /** GET /trips — Search trips with filters (public) */
  search = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.searchTrips(req.query as unknown as TripFilters)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /trips/slug/:slug — Get trip by slug (public) */
  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.getTripBySlug(req.params.slug)
    res.json({ success: true, data: trip })
  })

  /** GET /trips/:id — Get trip by ID (public) */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.getTripById(req.params.id)
    res.json({ success: true, data: trip })
  })

  /** GET /trips/my/list — List organizer's own trips (organizer only) */
  getMyTrips = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined
    const trips = await this.tripService.getMyTrips(req.user!.userId, status)
    res.json({ success: true, data: trips })
  })

  /** POST /trips — Create a new trip (organizer only) */
  create = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.createTrip(req.user!.userId, req.body)
    res.status(201).json({ success: true, data: trip })
  })

  /** PUT /trips/:id — Update an existing trip (organizer only) */
  update = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.updateTrip(req.user!.userId, req.params.id, req.body)
    res.json({ success: true, data: trip })
  })

  /** POST /trips/:id/publish — Publish a draft trip (organizer only) */
  publish = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.publishTrip(req.user!.userId, req.params.id)
    res.json({ success: true, data: trip })
  })

  /** DELETE /trips/:id — Soft-delete a trip (organizer only) */
  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.tripService.deleteTrip(req.user!.userId, req.params.id)
    res.json({ success: true, message: 'Trip deleted' })
  })

  /** PATCH /trips/:id/toggle-bookings — Toggle accepting bookings (organizer only) */
  toggleBookings = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.toggleBookings(req.user!.userId, req.params.id)
    res.json({ success: true, data: trip })
  })

  /** GET /trips/:id/history — Get paginated edit history (organizer only) */
  getEditHistory = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const result = await this.tripService.getTripEditHistory(req.user!.userId, req.params.id, page, limit)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /trips/organizer/stats — Get dashboard statistics (organizer only) */
  getOrganizerStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.tripService.getOrganizerStats(req.user!.userId)
    res.json({ success: true, data: stats })
  })

  /** GET /trips/organizer/pending-requests — All pending requests across trips (organizer only) */
  getAllPendingRequests = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.tripService.getAllPendingRequests(req.user!.userId)
    res.json({ success: true, data })
  })

  // ─── Trip Participants Dashboard ──────────────────────

  /** GET /trips/:tripId/bookings — List bookings for a trip (organizer only) */
  getTripBookings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.getTripBookings(
      req.user!.userId,
      req.params.tripId,
      tripBookingFiltersSchema.parse(req.query),
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /trips/:tripId/requests — List trip requests for a trip (organizer only) */
  getTripRequests = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.getTripRequests(
      req.user!.userId,
      req.params.tripId,
      tripRequestFiltersSchema.parse(req.query),
    )
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /trips/:tripId/summary — Get booking summary stats (organizer only) */
  getTripBookingSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.tripService.getTripBookingSummary(
      req.user!.userId,
      req.params.tripId,
    )
    res.json({ success: true, data: summary })
  })

  /** PATCH /trips/:tripId/requests/:requestId — Approve/reject a trip request (organizer only) */
  respondToRequest = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.respondToTripRequest(
      req.user!.userId,
      req.params.tripId,
      req.params.requestId,
      req.body.status,
      req.body.responseNote,
    )
    res.json({ success: true, data: result })
  })
}
