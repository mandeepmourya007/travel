import { Logger } from 'pino'
import { Prisma, TransferPointType } from '@prisma/client'
import type { CreateTripDto, UpdateTripDto, TripFilters } from '@shared/types/trip.types'
import type { TripBookingFilters } from '@shared/types/booking.types'
import type { TripRequestFilters, TripRequestTraveler } from '@shared/types/trip-request.types'
import { TripRepository, TRIP_INCLUDE_SUMMARY } from '../repositories/trip.repository'
import { DestinationRepository } from '../repositories/destination.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { TripEditHistoryRepository } from '../repositories/trip-edit-history.repository'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { ReviewRepository } from '../repositories/review.repository'
import type { NotificationService } from './notification.service'
import type { TripCategoryService } from './trip-category.service'
import type { CacheService } from './cache.service'
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../errors/app-error'
import { generateSlug, generateTripSlug } from '@shared/utils/slug'
import { areDocsComplete } from '@shared/utils/organizer-docs'
import type { OrganizerDocuments } from '@shared/types/user.types'
import { PAGINATION_DEFAULTS, APPROVAL_EXPIRY_HOURS, CACHE_TTL } from '../utils/constants'
import { cacheKeys, cacheInvalidation } from '../utils/cache-keys'
import { TRIP_STATUS, BOOKING_MODE, VERIFICATION_STATUS, TRIP_REQUEST_STATUS, TRANSFER_POINT_TYPE, NOTIFICATION_TYPE } from '@shared/constants'
import { mapTripToSummary } from '../utils/trip-mapper'

type TripWithDetail = NonNullable<Awaited<ReturnType<TripRepository['findById']>>>
type TripRequestItem = NonNullable<Awaited<ReturnType<TripRequestRepository['findById']>>>

type PublicOrganizerProfile = NonNullable<Awaited<ReturnType<OrganizerProfileRepository['findByIdPublic']>>>

export class TripService {
  constructor(
    private tripRepo: TripRepository,
    private destinationRepo: DestinationRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private editHistoryRepo: TripEditHistoryRepository,
    private bookingRepo: BookingRepository,
    private tripRequestRepo: TripRequestRepository,
    private reviewRepo: ReviewRepository,
    private logger: Logger,
    private notificationService: NotificationService,
    private tripCategoryService: TripCategoryService | null = null,
    private cache: CacheService | null = null,
  ) {}

  async searchTrips(filters: TripFilters) {
    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = Math.min(filters.limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const fetcher = async () => {
      const { data, total } = await this.tripRepo.search(filters, { offset, limit })
      return {
        data: data.map((trip) => mapTripToSummary(trip)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }

    if (this.cache) {
      return this.cache.getOrSet(cacheKeys.tripSearch({ ...filters, page, limit }), CACHE_TTL.TRIP_SEARCH, fetcher)
    }
    return fetcher()
  }

  async getTripBySlug(slug: string) {
    const fetcher = async () => {
      const trip = await this.tripRepo.findBySlug(slug)
      if (!trip) throw new NotFoundError('Trip')
      return this.toDetail(trip)
    }

    if (this.cache) {
      return this.cache.getOrSet(cacheKeys.tripDetail(slug), CACHE_TTL.TRIP_DETAIL, fetcher)
    }
    return fetcher()
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
    return trips.map((trip) => mapTripToSummary(trip))
  }

  async getOrganizerPublicProfile(
    organizerId: string,
    tripsPage = 1,
    tripsLimit = 12,
    reviewsPage = 1,
    reviewsLimit = 10,
  ) {
    const profile = await this.organizerProfileRepo.findByIdPublic(organizerId)
    if (!profile) throw new NotFoundError('Organizer')
    return this.buildOrganizerProfile(profile, tripsPage, tripsLimit, reviewsPage, reviewsLimit)
  }

  async getOrganizerPublicProfileBySlug(
    slug: string,
    tripsPage = 1,
    tripsLimit = 12,
    reviewsPage = 1,
    reviewsLimit = 10,
  ) {
    const fetcher = async () => {
      const profile = await this.organizerProfileRepo.findBySlugPublic(slug)
      if (!profile) throw new NotFoundError('Organizer')
      return this.buildOrganizerProfile(profile, tripsPage, tripsLimit, reviewsPage, reviewsLimit)
    }

    // Cache first page only (default pagination)
    if (this.cache && tripsPage === 1 && reviewsPage === 1) {
      return this.cache.getOrSet(cacheKeys.organizerProfile(slug), CACHE_TTL.ORGANIZER_PROFILE, fetcher)
    }
    return fetcher()
  }

  private async buildOrganizerProfile(
    profile: PublicOrganizerProfile,
    tripsPage = 1,
    tripsLimit = 12,
    reviewsPage = 1,
    reviewsLimit = 10,
  ) {
    const organizerId = profile.id
    const tripsOffset = (tripsPage - 1) * tripsLimit
    const reviewsOffset = (reviewsPage - 1) * reviewsLimit

    const [tripsResult, reviewResult, ratingStats, distribution] = await Promise.all([
      this.tripRepo.findByOrganizerIdPaginated(organizerId, 'ACTIVE', { offset: tripsOffset, limit: tripsLimit }),
      this.reviewRepo.findByOrganizerId(organizerId, { offset: reviewsOffset, limit: reviewsLimit }),
      this.reviewRepo.getOrganizerRatingStats(organizerId),
      this.reviewRepo.getRatingDistributionByOrganizer(organizerId),
    ])

    const avgRating = ratingStats._avg.overallRating ?? 0
    const totalReviewCount = ratingStats._count.overallRating ?? 0

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const entry of distribution) {
      dist[entry.overallRating] = entry._count.overallRating
    }

    return {
      organizer: {
        id: profile.id,
        slug: profile.slug,
        businessName: profile.businessName,
        description: profile.description,
        verified: profile.verificationStatus === VERIFICATION_STATUS.APPROVED,
        rating: Math.round(avgRating * 10) / 10,
        totalReviews: totalReviewCount,
        totalTripsCompleted: profile.totalTripsCompleted,
        memberSince: profile.user.createdAt,
      },
      trips: tripsResult.data.map((t) => mapTripToSummary(t)),
      tripsPagination: {
        page: tripsPage,
        limit: tripsLimit,
        total: tripsResult.total,
        totalPages: Math.ceil(tripsResult.total / tripsLimit),
      },
      reviews: reviewResult.data,
      reviewsSummary: {
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: totalReviewCount,
        distribution: dist as Record<1 | 2 | 3 | 4 | 5, number>,
      },
      reviewsPagination: {
        page: reviewsPage,
        limit: reviewsLimit,
        total: reviewResult.total,
        totalPages: Math.ceil(reviewResult.total / reviewsLimit),
      },
    }
  }

  async createTrip(userId: string, input: CreateTripDto) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')
    if (profile.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
      throw new ForbiddenError('Organizer profile must be approved before creating trips')
    }
    if (!areDocsComplete(profile.documents as OrganizerDocuments | null)) {
      throw new ForbiddenError('All verification documents (Aadhaar front, back, and PAN) must be uploaded before creating trips')
    }
    if (!profile.bankAccountLinked) {
      throw new ForbiddenError('Bank account must be linked before creating trips. Connect your bank account in Settings.')
    }

    const destination = await this.resolveDestination(input.destinationId)
    if (!destination) throw new ValidationError('Invalid destination')

    if (this.tripCategoryService) {
      await this.tripCategoryService.validateTripType(input.tripType)
    }

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
      transferPoints: {
        create: [
          ...input.pickupPoints.map((p, i) => ({ ...p, type: TransferPointType.PICKUP, sortOrder: i })),
          ...input.dropPoints.map((p, i) => ({ ...p, type: TransferPointType.DROP, sortOrder: i })),
        ],
      },
      itineraryDocUrl: input.itineraryDocUrl,
      bookingDeadline: input.bookingDeadline ? new Date(input.bookingDeadline) : undefined,
      organizer: { connect: { id: profile.id } },
      destination: { connect: { id: destination.id } },
    })

    this.logger.info({ tripId: trip.id, slug }, 'Trip created')
    await this.invalidateTripCaches()
    return mapTripToSummary(trip)
  }

  async updateTrip(userId: string, tripId: string, input: UpdateTripDto) {
    const { trip } = await this.verifyTripOwnership(userId, tripId)

    if (trip.status !== TRIP_STATUS.DRAFT && trip.status !== TRIP_STATUS.ACTIVE) {
      throw new ValidationError('Only DRAFT or ACTIVE trips can be edited')
    }

    if (input.destinationId) {
      const destination = await this.destinationRepo.findById(input.destinationId)
      if (!destination) throw new ValidationError('Invalid destination')
    }

    if (input.tripType && this.tripCategoryService) {
      await this.tripCategoryService.validateTripType(input.tripType)
    }

    const updateData: Record<string, unknown> = {}
    const changedFields: string[] = []
    const scalarFields: (keyof UpdateTripDto)[] = [
      'title', 'description', 'tripType', 'bookingMode', 'pricePerPerson',
      'earlyBirdPrice', 'minGroupSize', 'maxGroupSize', 'cancellationPolicy',
      'inclusions', 'exclusions', 'itinerary', 'photos',
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

    // Wrap scalar update + transfer point replacement in a single atomic transaction
    const updated = await this.tripRepo.withTransaction(async (tx) => {
      // Replace transfer points (soft-delete old + create new)
      if (input.pickupPoints) {
        await tx.tripTransferPoint.updateMany({
          where: { tripId, type: TransferPointType.PICKUP, isDeleted: false },
          data: { isDeleted: true, isActive: false, deletedAt: new Date() },
        })
        await tx.tripTransferPoint.createMany({
          data: input.pickupPoints.map((p, i) => ({
            ...p, tripId, type: TransferPointType.PICKUP, sortOrder: i,
          })),
        })
        changedFields.push('pickupPoints')
      }
      if (input.dropPoints) {
        await tx.tripTransferPoint.updateMany({
          where: { tripId, type: TransferPointType.DROP, isDeleted: false },
          data: { isDeleted: true, isActive: false, deletedAt: new Date() },
        })
        await tx.tripTransferPoint.createMany({
          data: input.dropPoints.map((p, i) => ({
            ...p, tripId, type: TransferPointType.DROP, sortOrder: i,
          })),
        })
        changedFields.push('dropPoints')
      }

      // Scalar field update inside same tx — include transferPoints so returned trip is complete
      return tx.trip.update({
        where: { id: tripId },
        data: updateData as Prisma.TripUpdateInput,
        include: {
          ...TRIP_INCLUDE_SUMMARY,
          transferPoints: {
            where: { isDeleted: false },
            orderBy: { sortOrder: 'asc' as const },
            select: { id: true, type: true, label: true, address: true, time: true, extraCharge: true, sortOrder: true },
          },
        },
      })
    })

    // Record edit history (skip for drafts to avoid noise)
    if (trip.status !== TRIP_STATUS.DRAFT && changedFields.length > 0) {
      await this.editHistoryRepo.create({
        tripId,
        editedById: userId,
        snapshot: JSON.parse(JSON.stringify(trip)),
        changedFields,
      })
    }

    this.logger.info({ tripId, changedFields }, 'Trip updated')
    await this.invalidateTripCaches(trip.slug)
    return mapTripToSummary(updated)
  }

  /**
   * Toggles the `acceptingBookings` flag on an ACTIVE trip.
   * Only the trip owner can toggle. Non-ACTIVE trips throw ValidationError.
   * When bookings are closed, travelers cannot create new bookings or requests.
   */
  async toggleBookings(userId: string, tripId: string) {
    const { trip } = await this.verifyTripOwnership(userId, tripId)

    if (trip.status !== TRIP_STATUS.ACTIVE) {
      throw new ValidationError('Only ACTIVE trips can toggle bookings')
    }

    const updated = await this.tripRepo.update(tripId, {
      acceptingBookings: !trip.acceptingBookings,
    })

    this.logger.info({ tripId, acceptingBookings: !trip.acceptingBookings }, 'Bookings toggled')
    await this.invalidateTripCaches(trip.slug)
    return mapTripToSummary(updated)
  }

  /**
   * Returns paginated edit history for a trip (audit trail).
   * Only the trip owner can view history. Each entry records
   * which fields changed and who made the edit.
   */
  async getTripEditHistory(userId: string, tripId: string, page = 1, limit = 20) {
    await this.verifyTripOwnership(userId, tripId)

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

    const fetcher = async () => {
      const [activeTrips, totalBookings, revenue, pendingRequests] = await Promise.all([
        this.tripRepo.countByOrganizerId(profile.id, 'ACTIVE'),
        this.tripRepo.sumBookingsByOrganizerId(profile.id),
        this.tripRepo.calculateOrganizerRevenue(profile.id),
        this.tripRepo.countPendingRequests(profile.id),
      ])
      return { activeTrips, totalBookings, revenue, pendingRequests }
    }

    if (this.cache) {
      return this.cache.getOrSet(cacheKeys.organizerStats(profile.id), CACHE_TTL.ORGANIZER_STATS, fetcher)
    }
    return fetcher()
  }

  async publishTrip(userId: string, tripId: string) {
    const { trip } = await this.verifyTripOwnership(userId, tripId)

    if (trip.status !== TRIP_STATUS.DRAFT) {
      throw new ValidationError('Only DRAFT trips can be published')
    }

    if (!trip.title || !trip.description || !trip.pricePerPerson) {
      throw new ValidationError('Trip must have title, description, and price before publishing')
    }

    const tripWithPoints = trip as typeof trip & { transferPoints?: { type: string }[] }
    const hasPickup = tripWithPoints.transferPoints?.some((p) => p.type === TRANSFER_POINT_TYPE.PICKUP)
    const hasDrop = tripWithPoints.transferPoints?.some((p) => p.type === TRANSFER_POINT_TYPE.DROP)
    if (!hasPickup) throw new ValidationError('Trip must have at least one pickup point before publishing')
    if (!hasDrop) throw new ValidationError('Trip must have at least one drop point before publishing')

    const updated = await this.tripRepo.withTransaction(async (tx) => {
      const result = await tx.trip.update({
        where: { id: tripId },
        data: { status: TRIP_STATUS.ACTIVE },
        include: { destination: { select: { id: true, name: true, slug: true } }, organizer: { select: { id: true, slug: true, businessName: true, rating: true, totalReviews: true, verificationStatus: true } } },
      })
      await tx.destination.update({
        where: { id: trip.destinationId },
        data: { tripCount: { increment: 1 } },
      })
      return result
    })

    this.logger.info({ tripId }, 'Trip published')
    await this.invalidateTripCaches()
    await this.cache?.invalidateByPrefix(cacheInvalidation.allDestinations())
    return mapTripToSummary(updated)
  }

  async deleteTrip(userId: string, tripId: string) {
    const { trip } = await this.verifyTripOwnership(userId, tripId)

    if (trip.currentBookings > 0) {
      throw new ValidationError('Cannot delete a trip with existing bookings')
    }

    await this.tripRepo.withTransaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: { isDeleted: true, isActive: false, deletedAt: new Date() },
      })
      if (trip.status === TRIP_STATUS.ACTIVE) {
        await tx.destination.update({
          where: { id: trip.destinationId },
          data: { tripCount: { decrement: 1 } },
        })
      }
    })
    this.logger.info({ tripId }, 'Trip soft-deleted')
    await this.invalidateTripCaches(trip.slug)
    await this.cache?.invalidateByPrefix(cacheInvalidation.allDestinations())
  }

  // ─── Trip Duplication ────────────────────────────────

  /**
   * Creates a DRAFT copy of an existing trip, owned by the same organizer.
   * Copies all content, pricing, transfer points, and vehicle layouts.
   * Strips dates (startDate, endDate, earlyBirdDeadline, bookingDeadline) and
   * all bookings — the organizer sets new dates before publishing.
   *
   * Idempotent slug generation appends suffix if the base slug is taken.
   *
   * @throws NotFoundError  — source trip not found
   * @throws ForbiddenError — caller doesn't own the trip or isn't an approved organizer
   */
  async duplicateTrip(userId: string, sourceTripId: string) {
    const { trip: source, profile } = await this.verifyTripOwnership(userId, sourceTripId)

    // Build a unique slug for the duplicate
    const baseSlug = `${source.slug}-copy`
    let slug = baseSlug
    let suffix = 0
    while (await this.tripRepo.slugExists(slug)) {
      suffix++
      slug = `${baseSlug}-${suffix}`
    }

    // Fetch full source trip detail for transfer points
    const sourceDetail = await this.tripRepo.findById(sourceTripId)
    if (!sourceDetail) throw new NotFoundError('Trip')

    const pickupPoints = sourceDetail.transferPoints
      .filter((p) => p.type === 'PICKUP')
      .map((p) => ({ label: p.label, address: p.address ?? undefined, time: p.time ?? undefined, extraCharge: p.extraCharge, sortOrder: p.sortOrder }))
    const dropPoints = sourceDetail.transferPoints
      .filter((p) => p.type === 'DROP')
      .map((p) => ({ label: p.label, address: p.address ?? undefined, time: p.time ?? undefined, extraCharge: p.extraCharge, sortOrder: p.sortOrder }))

    const copy = await this.tripRepo.create({
      title: `${source.title} (Copy)`,
      slug,
      tripType: source.tripType,
      bookingMode: source.bookingMode,
      description: source.description,
      // Dates intentionally omitted — organizer must set them
      startDate: new Date(Date.now() + 7 * 86400 * 1000), // placeholder 7 days out
      endDate: new Date(Date.now() + 8 * 86400 * 1000),
      pricePerPerson: source.pricePerPerson,
      earlyBirdPrice: source.earlyBirdPrice ?? undefined,
      minGroupSize: source.minGroupSize,
      maxGroupSize: source.maxGroupSize,
      cancellationPolicy: source.cancellationPolicy ?? undefined,
      inclusions: source.inclusions as string[],
      exclusions: source.exclusions as string[],
      itinerary: source.itinerary as Prisma.InputJsonValue,
      photos: source.photos as string[],
      transferPoints: {
        create: [
          ...pickupPoints.map((p, i) => ({ ...p, type: 'PICKUP' as const, sortOrder: i })),
          ...dropPoints.map((p, i) => ({ ...p, type: 'DROP' as const, sortOrder: i })),
        ],
      },
      organizer: { connect: { id: profile.id } },
      destination: { connect: { id: source.destinationId } },
    })

    this.logger.info({ sourceId: sourceTripId, copyId: copy.id, slug }, 'Trip duplicated')
    await this.invalidateTripCaches()
    return mapTripToSummary(copy)
  }

  // ─── Trip Participants Dashboard Methods ──────────────

  /**
   * Returns paginated bookings for a trip (organizer's participants view).
   * Only the trip owner can view. Supports status filter + user name search.
   *
   * @throws NotFoundError — trip doesn't exist
   * @throws ForbiddenError — user doesn't own the trip
   */
  async getTripBookings(userId: string, tripId: string, filters: TripBookingFilters) {
    await this.verifyTripOwnership(userId, tripId)

    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = Math.min(filters.limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const { data, total } = await this.bookingRepo.findByTripId(tripId, filters, { offset, limit })

    return {
      data: data.map((b) => ({
        id: b.id,
        bookingRef: b.bookingRef,
        bookingStatus: b.bookingStatus,
        numTravelers: b.numTravelers,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
        user: b.user,
        travelerDetails: b.travelerDetails.map((t) => ({
          ...t,
          assignedSeat: t.assignedSeat
            ? { seatNumber: t.assignedSeat.seatNumber, seatLabel: t.assignedSeat.seatLabel, vehicleName: t.assignedSeat.tripVehicle.label }
            : null,
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  /**
   * Returns paginated trip requests for a trip (organizer's participants view).
   * Only the trip owner can view. Supports status filter + user name search.
   *
   * @throws NotFoundError — trip doesn't exist
   * @throws ForbiddenError — user doesn't own the trip
   */
  async getTripRequests(userId: string, tripId: string, filters: TripRequestFilters) {
    await this.verifyTripOwnership(userId, tripId)

    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = Math.min(filters.limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const { data, total } = await this.tripRequestRepo.findByTripId(tripId, filters, { offset, limit })

    return {
      data: data.map((r) => this.toRequestListItem(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  /**
   * Returns aggregated booking summary stats for a trip's stats bar.
   * Includes confirmed count, total travelers, seats left, revenue, pending requests.
   *
   * @throws NotFoundError — trip doesn't exist
   * @throws ForbiddenError — user doesn't own the trip
   */
  async getTripBookingSummary(userId: string, tripId: string) {
    const { trip } = await this.verifyTripOwnership(userId, tripId)

    const summary = await this.bookingRepo.getTripBookingSummary(tripId)

    return {
      ...summary,
      maxGroupSize: trip.maxGroupSize,
      seatsLeft: Math.max(0, trip.maxGroupSize - trip.currentBookings),
    }
  }

  /**
   * Approves or rejects a pending trip request.
   *
   * Business rules:
   * - Only the trip owner can respond
   * - Only PENDING requests can be responded to
   * - On APPROVE: sets approvalExpiresAt to now + 48h, traveler must pay within window
   * - On REJECT: sets responseNote (reason), no further action needed
   * - Capacity check on approve: trip must have enough seats for numTravelers
   *
   * @throws NotFoundError — trip or request doesn't exist
   * @throws ForbiddenError — user doesn't own the trip
   * @throws ValidationError — request is not PENDING, or not enough seats
   */
  async respondToTripRequest(
    userId: string,
    tripId: string,
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    responseNote?: string,
  ) {
    const { trip } = await this.verifyTripOwnership(userId, tripId)

    const request = await this.tripRequestRepo.findById(requestId)
    if (!request) throw new NotFoundError('Trip request')
    if (request.tripId !== tripId) throw new NotFoundError('Trip request')

    if (request.status !== TRIP_REQUEST_STATUS.PENDING) {
      throw new ValidationError('Only PENDING requests can be responded to')
    }

    // Capacity check uses already-fetched trip data to avoid extra DB call
    if (action === 'APPROVED') {
      const seatsLeft = trip.maxGroupSize - trip.currentBookings
      if (request.numTravelers > seatsLeft) {
        throw new ValidationError(
          `Not enough seats. Requested: ${request.numTravelers}, available: ${seatsLeft}`,
        )
      }
    }

    const approvalExpiresAt =
      action === 'APPROVED'
        ? new Date(Date.now() + APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000)
        : undefined

    const updated = await this.tripRequestRepo.updateStatus(requestId, {
      status: action,
      responseNote,
      approvalExpiresAt,
    })

    this.logger.info(
      { tripId, requestId, action, responseNote },
      'Trip request responded',
    )

    // Fire-and-forget: notify traveler of request response
    const notifType = action === TRIP_REQUEST_STATUS.APPROVED ? NOTIFICATION_TYPE.TRIP_REQUEST_APPROVED : NOTIFICATION_TYPE.TRIP_REQUEST_REJECTED
    const title = action === TRIP_REQUEST_STATUS.APPROVED
      ? `Your request for ${trip.title} was approved!`
      : `Your request for ${trip.title} was rejected`
    const body = action === TRIP_REQUEST_STATUS.APPROVED
      ? 'You have 48 hours to complete your payment and secure your spot.'
      : responseNote || 'The organizer has declined your request.'

    this.notificationService.send({
      userId: request.userId,
      type: notifType,
      title,
      body,
      data: { tripId, requestId, tripSlug: trip.slug, tripName: trip.title },
    }).catch((err) => this.logger.error({ err, requestId }, 'Failed to send trip request response notification'))

    return this.toRequestListItem(updated)
  }

  /**
   * Returns all pending trip requests across organizer's trips, with trip context.
   * Used by the dashboard "Pending Requests" page for cross-trip view.
   * No pagination — pending requests are low-volume.
   *
   * @throws ForbiddenError — organizer profile not found
   */
  async getAllPendingRequests(userId: string) {
    const profile = await this.organizerProfileRepo.findByUserId(userId)
    if (!profile) throw new ForbiddenError('Organizer profile not found')

    const requests = await this.tripRequestRepo.findAllPendingForOrganizer(profile.id)
    return requests.map((r) => ({
      ...this.toRequestListItem(r),
      trip: r.trip,
    }))
  }

  /**
   * Traveler sends a request to join a REQUEST_BASED trip.
   *
   * Validations:
   * - Trip exists and is ACTIVE
   * - Trip.bookingMode must be REQUEST_BASED
   * - Trip.acceptingBookings must be true
   * - Enough seats for numTravelers
   * - No existing request from this user (@@unique handles via P2002)
   *
   * @throws NotFoundError — trip doesn't exist
   * @throws ValidationError — trip not active, wrong mode, full, not accepting
   * @throws ConflictError — user already has a request for this trip
   */
  async createTripRequest(
    userId: string,
    tripId: string,
    dto: { numTravelers: number; message?: string; travelers?: TripRequestTraveler[] },
  ) {
    const trip = await this.tripRepo.findByIdLite(tripId)
    if (!trip) throw new NotFoundError('Trip')

    if (trip.status !== TRIP_STATUS.ACTIVE) {
      throw new ValidationError('This trip is not accepting requests')
    }
    if (trip.bookingMode !== BOOKING_MODE.REQUEST_BASED) {
      throw new ValidationError('This trip accepts direct bookings — no request needed')
    }
    if (!trip.acceptingBookings) {
      throw new ValidationError('This trip is no longer accepting bookings')
    }

    const seatsLeft = trip.maxGroupSize - trip.currentBookings
    if (dto.numTravelers > seatsLeft) {
      throw new ValidationError(
        `Not enough seats. Requested: ${dto.numTravelers}, available: ${seatsLeft}`,
      )
    }

    // Allow re-application: if user has an EXPIRED or REJECTED request, reset it
    const existingStale = await this.tripRequestRepo.findExpiredOrRejectedForUser(tripId, userId)
    if (existingStale) {
      const reset = await this.tripRequestRepo.resetToPending(existingStale.id, {
        numTravelers: dto.numTravelers,
        message: dto.message,
        travelers: dto.travelers,
      })
      this.logger.info({ tripId, userId, requestId: reset.id }, 'Trip request re-submitted (was expired/rejected)')
      return this.toRequestListItem(reset)
    }

    try {
      const request = await this.tripRequestRepo.create({
        tripId,
        userId,
        numTravelers: dto.numTravelers,
        message: dto.message,
        travelers: dto.travelers,
      })
      this.logger.info({ tripId, userId, requestId: request.id }, 'Trip request created')

      // Fire-and-forget: notify organizer of new request
      this.notificationService.send({
        userId: trip.organizer.userId,
        type: NOTIFICATION_TYPE.TRIP_REQUEST_RECEIVED,
        title: 'New Trip Request',
        body: `A traveler has requested to join "${trip.title}" (${dto.numTravelers} traveler${dto.numTravelers > 1 ? 's' : ''}).`,
        data: { tripId, requestId: request.id, tripSlug: trip.slug, tripName: trip.title, numTravelers: dto.numTravelers },
      }).catch((err) => this.logger.error({ err, tripId }, 'Failed to send trip request notification to organizer'))

      return this.toRequestListItem(request)
    } catch (error: unknown) {
      // Prisma P2002 = unique constraint violation (user already has an active request)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('You already have a pending request for this trip')
      }
      throw error
    }
  }

  /** Invalidate trip search caches (and optionally a specific detail page). */
  private async invalidateTripCaches(slug?: string) {
    if (!this.cache) return
    await this.cache.invalidateByPrefix(cacheInvalidation.allTrips())
    if (slug) await this.cache.del(cacheKeys.tripDetail(slug))
  }

  /**
   * Verifies that a trip exists and the user is its owner.
   * Returns the trip and organizer profile for further use.
   */
  private async verifyTripOwnership(userId: string, tripId: string) {
    const [trip, profile] = await Promise.all([
      this.tripRepo.findById(tripId),
      this.organizerProfileRepo.findByUserId(userId),
    ])
    if (!trip) throw new NotFoundError('Trip')

    if (!profile || trip.organizerId !== profile.id) {
      throw new ForbiddenError('You can only manage your own trips')
    }

    return { trip, profile }
  }

  /**
   * Resolves a destination input that can be an existing slug/ID or a new name.
   * Lookup order: ID → slug (indexed, unique) → name (case-insensitive) → auto-create.
   */
  private async resolveDestination(destinationId: string) {
    const input = destinationId.trim()

    // 0. Try ID lookup first (FE sends existing destination ID from the dropdown)
    const byId = await this.destinationRepo.findById(input)
    if (byId) return byId

    const slug = generateSlug(input)

    // 1. Try slug lookup (fast, indexed, covers both typed names and existing slugs)
    const bySlug = await this.destinationRepo.findBySlug(slug)
    if (bySlug) return bySlug

    // 2. Try exact name (case-insensitive) — covers names that may not match slug
    const byName = await this.destinationRepo.findByName(input)
    if (byName) return byName

    // 3. Auto-create new destination
    return this.destinationRepo.create({
      name: input,
      slug,
      state: input,
    })
  }

  /**
   * Maps a TripRequest DB row (with user + travelerDetails includes) to the API list shape.
   * Typed via ReturnType inference — stays in sync when REQUEST_INCLUDE_LIST changes.
   */
  private toRequestListItem(r: TripRequestItem) {
    return {
      id: r.id,
      numTravelers: r.numTravelers,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      responseNote: r.responseNote,
      approvalExpiresAt: r.approvalExpiresAt,
      travelerDetails: r.travelerDetails ?? null,
      user: r.user,
    }
  }

  /**
   * Maps a full trip DB row (with TRIP_INCLUDE_DETAIL) to the detail API shape.
   * Typed via ReturnType inference — stays in sync when TRIP_INCLUDE_DETAIL changes.
   */
  private toDetail(trip: TripWithDetail) {
    return {
      ...mapTripToSummary(trip),
      description: trip.description,
      minGroupSize: trip.minGroupSize,
      cancellationPolicy: trip.cancellationPolicy,
      inclusions: trip.inclusions,
      exclusions: trip.exclusions,
      itinerary: trip.itinerary,
      pickupPoints: trip.transferPoints?.filter((p: { type: string }) => p.type === TRANSFER_POINT_TYPE.PICKUP) ?? [],
      dropPoints: trip.transferPoints?.filter((p: { type: string }) => p.type === TRANSFER_POINT_TYPE.DROP) ?? [],
      earlyBirdDeadline: trip.earlyBirdDeadline,
      bookingDeadline: trip.bookingDeadline,
      reviews: trip.reviews?.map((r: { id: string; overallRating: number; comment: string | null; photos: string[]; editedAt: Date | null; organizerReply: string | null; organizerReplyAt: Date | null; createdAt: Date; user: { id: string; name: string; avatarUrl: string | null } }) => ({
        id: r.id,
        overallRating: r.overallRating,
        comment: r.comment,
        photos: r.photos,
        editedAt: r.editedAt,
        organizerReply: r.organizerReply,
        organizerReplyAt: r.organizerReplyAt,
        createdAt: r.createdAt,
        user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl },
      })) ?? [],
    }
  }
}
