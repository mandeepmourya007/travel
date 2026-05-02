import { Logger } from 'pino'
import { Prisma } from '@prisma/client'
import type { CreateTripDto, UpdateTripDto, TripFilters } from '@shared/types/trip.types'
import { TripRepository } from '../repositories/trip.repository'
import { DestinationRepository } from '../repositories/destination.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { TripEditHistoryRepository } from '../repositories/trip-edit-history.repository'
import { NotFoundError, ValidationError, ForbiddenError } from '../errors/app-error'
import { generateTripSlug } from '../utils/slug'
import { PAGINATION_DEFAULTS } from '../utils/constants'

export class TripService {
  constructor(
    private tripRepo: TripRepository,
    private destinationRepo: DestinationRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private editHistoryRepo: TripEditHistoryRepository,
    private logger: Logger,
  ) {}

  async searchTrips(filters: TripFilters) {
    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = Math.min(filters.limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const { data, total } = await this.tripRepo.search(filters, { offset, limit })

    return {
      data: data.map((trip) => this.toSummary(trip)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getTripBySlug(slug: string) {
    const trip = await this.tripRepo.findBySlug(slug)
    if (!trip) throw new NotFoundError('Trip')
    return this.toDetail(trip)
  }

  async getTripById(id: string) {
    const trip = await this.tripRepo.findById(id)
    if (!trip) throw new NotFoundError('Trip')
    return this.toDetail(trip)
  }

  async getMyTrips(userId: string, status?: string) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')

    const trips = await this.tripRepo.findByOrganizerId(profile.id, status)
    return trips.map((trip) => this.toSummary(trip))
  }

  async createTrip(userId: string, input: CreateTripDto) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')
    if (profile.verificationStatus !== 'APPROVED') {
      throw new ForbiddenError('Organizer profile must be approved before creating trips')
    }

    const destination = await this.destinationRepo.findById(input.destinationId)
    if (!destination) throw new ValidationError('Invalid destination')

    if (new Date(input.startDate) <= new Date()) {
      throw new ValidationError('Start date must be in the future')
    }

    let slug = generateTripSlug(input.title, input.startDate)
    let suffix = 0
    while (await this.tripRepo.slugExists(slug)) {
      suffix++
      slug = `${generateTripSlug(input.title, input.startDate)}-${suffix}`
    }

    const trip = await this.tripRepo.create({
      title: input.title,
      slug,
      tripType: input.tripType,
      bookingMode: input.bookingMode,
      description: input.description,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      pricePerPerson: input.pricePerPerson,
      earlyBirdPrice: input.earlyBirdPrice,
      earlyBirdDeadline: input.earlyBirdDeadline ? new Date(input.earlyBirdDeadline) : undefined,
      minGroupSize: input.minGroupSize,
      maxGroupSize: input.maxGroupSize,
      cancellationPolicy: input.cancellationPolicy,
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      itinerary: input.itinerary as unknown as Prisma.InputJsonValue,
      photos: input.photos,
      pickupLocation: input.pickupLocation,
      pickupTime: input.pickupTime,
      itineraryDocUrl: input.itineraryDocUrl,
      bookingDeadline: input.bookingDeadline ? new Date(input.bookingDeadline) : undefined,
      organizer: { connect: { id: profile.id } },
      destination: { connect: { id: input.destinationId } },
    })

    this.logger.info({ tripId: trip.id, slug }, 'Trip created')
    return this.toSummary(trip)
  }

  async updateTrip(userId: string, tripId: string, input: UpdateTripDto) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')

    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile || trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only edit your own trips')
    }

    if (trip.status !== 'DRAFT' && trip.status !== 'ACTIVE') {
      throw new ValidationError('Only DRAFT or ACTIVE trips can be edited')
    }

    if (input.destinationId) {
      const destination = await this.destinationRepo.findById(input.destinationId)
      if (!destination) throw new ValidationError('Invalid destination')
    }

    const updateData: Record<string, unknown> = {}
    const changedFields: string[] = []
    const scalarFields: (keyof UpdateTripDto)[] = [
      'title', 'description', 'tripType', 'bookingMode', 'pricePerPerson',
      'earlyBirdPrice', 'minGroupSize', 'maxGroupSize', 'cancellationPolicy',
      'inclusions', 'exclusions', 'itinerary', 'photos', 'pickupLocation', 'pickupTime',
      'itineraryDocUrl', 'acceptingBookings',
    ]
    for (const key of scalarFields) {
      if (input[key] !== undefined) {
        updateData[key] = input[key]
        changedFields.push(key)
      }
    }
    if (input.startDate) { updateData.startDate = new Date(input.startDate); changedFields.push('startDate') }
    if (input.endDate) { updateData.endDate = new Date(input.endDate); changedFields.push('endDate') }
    if (input.earlyBirdDeadline) { updateData.earlyBirdDeadline = new Date(input.earlyBirdDeadline); changedFields.push('earlyBirdDeadline') }
    if (input.bookingDeadline) { updateData.bookingDeadline = new Date(input.bookingDeadline); changedFields.push('bookingDeadline') }
    if (input.destinationId) {
      updateData.destination = { connect: { id: input.destinationId } }
      changedFields.push('destinationId')
    }

    const updated = await this.tripRepo.update(tripId, updateData)

    // Record edit history (skip for drafts to avoid noise)
    if (trip.status !== 'DRAFT' && changedFields.length > 0) {
      await this.editHistoryRepo.create({
        tripId,
        editedById: userId,
        snapshot: JSON.parse(JSON.stringify(trip)),
        changedFields,
      })
    }

    this.logger.info({ tripId, changedFields }, 'Trip updated')
    return this.toSummary(updated)
  }

  /**
   * Toggles the `acceptingBookings` flag on an ACTIVE trip.
   * Only the trip owner can toggle. Non-ACTIVE trips throw ValidationError.
   * When bookings are closed, travelers cannot create new bookings or requests.
   */
  async toggleBookings(userId: string, tripId: string) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')

    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile || trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only manage your own trips')
    }

    if (trip.status !== 'ACTIVE') {
      throw new ValidationError('Only ACTIVE trips can toggle bookings')
    }

    const updated = await this.tripRepo.update(tripId, {
      acceptingBookings: !trip.acceptingBookings,
    })

    this.logger.info({ tripId, acceptingBookings: !trip.acceptingBookings }, 'Bookings toggled')
    return this.toSummary(updated)
  }

  /**
   * Returns paginated edit history for a trip (audit trail).
   * Only the trip owner can view history. Each entry records
   * which fields changed and who made the edit.
   */
  async getTripEditHistory(userId: string, tripId: string, page = 1, limit = 20) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')

    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile || trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only view history of your own trips')
    }

    const offset = (page - 1) * limit
    const { data, total } = await this.editHistoryRepo.findByTripId(tripId, { offset, limit })

    return {
      data: data.map((entry: { id: string; editedBy: { id: string; name: string }; changedFields: string[]; editNote: string | null; createdAt: Date }) => ({
        id: entry.id,
        editedBy: entry.editedBy,
        changedFields: entry.changedFields,
        editNote: entry.editNote,
        createdAt: entry.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  /**
   * Aggregates dashboard statistics for an organizer:
   * - activeTrips: count of trips with status=ACTIVE
   * - totalBookings: sum of currentBookings across all trips
   * - revenue: net revenue = CAPTURED payments − CAPTURED refunds (from PaymentTransaction)
   * - pendingRequests: count of PENDING trip requests awaiting organizer decision
   *
   * Revenue edge cases:
   * - Only CAPTURED status payments count (+ve), CAPTURED refunds subtract (−ve)
   * - INITIATED/FAILED/ESCROW_RELEASE transactions are excluded
   * - A fully refunded booking contributes ₹0 to revenue
   * - Deleted trips are excluded from revenue calculation
   */
  async getOrganizerStats(userId: string) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')

    const trips = await this.tripRepo.findByOrganizerId(profile.id)

    const activeTrips = trips.filter((t) => t.status === 'ACTIVE').length
    const totalBookings = trips.reduce((sum, t) => sum + t.currentBookings, 0)
    const [revenue, pendingRequests] = await Promise.all([
      this.tripRepo.calculateOrganizerRevenue(profile.id),
      this.tripRepo.countPendingRequests(profile.id),
    ])

    return { activeTrips, totalBookings, revenue, pendingRequests }
  }

  async publishTrip(userId: string, tripId: string) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')

    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile || trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only publish your own trips')
    }

    if (trip.status !== 'DRAFT') {
      throw new ValidationError('Only DRAFT trips can be published')
    }

    if (!trip.title || !trip.description || !trip.pricePerPerson) {
      throw new ValidationError('Trip must have title, description, and price before publishing')
    }

    const updated = await this.tripRepo.withTransaction(async (tx) => {
      const result = await tx.trip.update({
        where: { id: tripId },
        data: { status: 'ACTIVE' },
        include: { destination: { select: { id: true, name: true, slug: true } }, organizer: { select: { id: true, businessName: true, rating: true, totalReviews: true, verificationStatus: true } } },
      })
      await tx.destination.update({
        where: { id: trip.destinationId },
        data: { tripCount: { increment: 1 } },
      })
      return result
    })

    this.logger.info({ tripId }, 'Trip published')
    return this.toSummary(updated)
  }

  async deleteTrip(userId: string, tripId: string) {
    const trip = await this.tripRepo.findById(tripId)
    if (!trip) throw new NotFoundError('Trip')

    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile || trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only delete your own trips')
    }

    if (trip.currentBookings > 0) {
      throw new ValidationError('Cannot delete a trip with existing bookings')
    }

    await this.tripRepo.withTransaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: { isDeleted: true, isActive: false, deletedAt: new Date() },
      })
      if (trip.status === 'ACTIVE') {
        await tx.destination.update({
          where: { id: trip.destinationId },
          data: { tripCount: { decrement: 1 } },
        })
      }
    })
    this.logger.info({ tripId }, 'Trip soft-deleted')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toSummary(trip: any) {
    return {
      id: trip.id,
      title: trip.title,
      slug: trip.slug,
      destination: trip.destination
        ? { id: trip.destination.id, name: trip.destination.name, slug: trip.destination.slug }
        : undefined,
      tripType: trip.tripType,
      bookingMode: trip.bookingMode,
      pricePerPerson: trip.pricePerPerson,
      earlyBirdPrice: trip.earlyBirdPrice,
      startDate: trip.startDate,
      endDate: trip.endDate,
      maxGroupSize: trip.maxGroupSize,
      currentBookings: trip.currentBookings,
      status: trip.status,
      acceptingBookings: trip.acceptingBookings,
      photos: trip.photos,
      organizer: trip.organizer
        ? {
            id: trip.organizer.id,
            businessName: trip.organizer.businessName,
            rating: trip.organizer.rating,
            totalReviews: trip.organizer.totalReviews,
            verified: trip.organizer.verificationStatus === 'APPROVED',
          }
        : undefined,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDetail(trip: any) {
    return {
      ...this.toSummary(trip),
      description: trip.description,
      minGroupSize: trip.minGroupSize,
      cancellationPolicy: trip.cancellationPolicy,
      inclusions: trip.inclusions,
      exclusions: trip.exclusions,
      itinerary: trip.itinerary,
      pickupLocation: trip.pickupLocation,
      pickupTime: trip.pickupTime,
      earlyBirdDeadline: trip.earlyBirdDeadline,
      bookingDeadline: trip.bookingDeadline,
      reviews: trip.reviews?.map((r: { id: string; overallRating: number; comment: string | null; createdAt: Date; user: { id: string; name: string; avatarUrl: string | null } }) => ({
        id: r.id,
        overallRating: r.overallRating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl },
      })) ?? [],
    }
  }
}
