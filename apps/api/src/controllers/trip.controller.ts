import { Request, Response } from 'express'
import type { z } from 'zod'
import type { TripFilters } from '@shared/types/trip.types'
import { tripBookingFiltersSchema, tripRequestFiltersSchema } from '@shared/validators/booking.schema'
import { organizerProfileQuerySchema } from '@shared/validators/common.schema'
import { asyncHandler } from '../utils/async-handler'
import { TripService } from '../services/trip.service'

type OrganizerProfileQuery = z.output<typeof organizerProfileQuerySchema>

export class TripController {
  constructor(private tripService: TripService) {}

  /** GET /trips — Search trips with filters (public) */
  search = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.searchTrips(req.query as TripFilters)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** GET /trips/organizers/:organizerId — Public organizer profile with trips + reviews */
  getOrganizerPublicProfile = asyncHandler(async (req: Request, res: Response) => {
    // validate middleware already parsed req.query via organizerProfileQuerySchema
    const { tripsPage, tripsLimit, reviewsPage, reviewsLimit } = req.query as unknown as OrganizerProfileQuery
    const data = await this.tripService.getOrganizerPublicProfile(
      req.params.organizerId, tripsPage, tripsLimit, reviewsPage, reviewsLimit,
    )
    res.json({ success: true, data })
  })

  /** GET /trips/organizers/slug/:slug — Public organizer profile by slug */
  getOrganizerPublicProfileBySlug = asyncHandler(async (req: Request, res: Response) => {
    // validate middleware already parsed req.query via organizerProfileQuerySchema
    const { tripsPage, tripsLimit, reviewsPage, reviewsLimit } = req.query as unknown as OrganizerProfileQuery
    const data = await this.tripService.getOrganizerPublicProfileBySlug(
      req.params.slug, tripsPage, tripsLimit, reviewsPage, reviewsLimit,
    )
    res.json({ success: true, data })
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

  /** GET /trips/my/search — Searchable + paginated trip list for comboboxes */
  searchMyTrips = asyncHandler(async (req: Request, res: Response) => {
    const { q, page, limit, status } = req.query as { q?: string; page: string; limit: string; status?: string }
    const result = await this.tripService.searchMyTrips(req.user!.userId, {
      q,
      page: Number(page),
      limit: Number(limit),
      status,
    })
    res.json({ success: true, ...result })
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

  /** POST /trips/:id/duplicate — Clone trip as DRAFT (organizer only) */
  duplicate = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.duplicateTrip(req.user!.userId, req.params.id)
    res.status(201).json({ success: true, data: trip })
  })

  /** DELETE /trips/:id — Soft-delete a trip (organizer only) */
  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.tripService.deleteTrip(req.user!.userId, req.params.id)
    res.json({ success: true, message: 'Trip deleted' })
  })

  /** PATCH /trips/:id/toggle-bookings — Pause or resume bookings (organizer only) */
  toggleBookings = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.setBookingPause(req.user!.userId, req.params.id, req.body)
    res.json({ success: true, data: trip })
  })

  /** PATCH /trips/:id/visibility — Hide or unhide a trip (organizer only) */
  setVisibility = asyncHandler(async (req: Request, res: Response) => {
    const trip = await this.tripService.setVisibility(req.user!.userId, req.params.id, req.body)
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

  /** POST /trips/:tripId/request — Traveler sends a booking request (C2 fix: map numberOfTravelers → numTravelers) */
  createRequest = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.tripService.createTripRequest(
      req.user!.userId,
      req.params.tripId,
      { numTravelers: req.body.numberOfTravelers, message: req.body.message, travelers: req.body.travelers },
    )
    res.status(201).json({ success: true, data: result })
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
