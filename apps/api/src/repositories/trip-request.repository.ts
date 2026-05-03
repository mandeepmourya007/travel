import { Prisma, type Gender } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { TripRequestFilters } from '@shared/types/trip-request.types'

const TRAVELER_DETAIL_SELECT = {
  where: { isDeleted: false },
  select: {
    name: true,
    phone: true,
    age: true,
    gender: true,
    isPrimary: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
  },
} as const

const REQUEST_INCLUDE_LIST = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  travelerDetails: TRAVELER_DETAIL_SELECT,
} as const

export class TripRequestRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Finds paginated trip requests for a specific trip with optional filters.
   *
   * WHERE: tripId, isDeleted=false, optional status, optional user name search
   * Include: user (id, name, email, avatarUrl)
   * Used by: TripService.getTripRequests()
   *
   * Edge cases:
   * - Returns { data: [], total: 0 } when no requests match
   * - Search is case-insensitive partial match on user.name
   */
  async findByTripId(
    tripId: string,
    filters: TripRequestFilters,
    pagination: { offset: number; limit: number },
  ) {
    const where = this.buildWhere(tripId, filters)
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tripRequest.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: REQUEST_INCLUDE_LIST,
      }),
      this.prisma.tripRequest.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Finds a single trip request by ID.
   *
   * WHERE: id, isDeleted=false
   * Used by: TripService.respondToTripRequest()
   */
  async findById(id: string) {
    return this.prisma.tripRequest.findFirst({
      where: { id, isDeleted: false },
      include: REQUEST_INCLUDE_LIST,
    })
  }

  /**
   * Updates trip request status and response fields.
   *
   * Used by: TripService.respondToTripRequest() for approve/reject actions
   * Sets respondedAt to current timestamp on every status update.
   */
  async updateStatus(
    id: string,
    data: {
      status: string
      responseNote?: string
      approvalExpiresAt?: Date
    },
  ) {
    return this.prisma.tripRequest.update({
      where: { id },
      data: {
        status: data.status as Prisma.EnumTripRequestStatusFieldUpdateOperationsInput['set'],
        responseNote: data.responseNote ?? null,
        respondedAt: new Date(),
        ...(data.approvalExpiresAt && { approvalExpiresAt: data.approvalExpiresAt }),
      },
      include: REQUEST_INCLUDE_LIST,
    })
  }

  /**
   * Finds an approved, non-expired trip request for a user on a specific trip.
   *
   * Used by: BookingService.createBooking() — REQUEST_BASED booking mode check
   * WHERE: tripId, userId, status=APPROVED, approvalExpiresAt > now
   *
   * @returns The approved request or null
   */
  async findApprovedForUser(tripId: string, userId: string) {
    return this.prisma.tripRequest.findFirst({
      where: {
        tripId,
        userId,
        status: 'APPROVED',
        isDeleted: false,
        approvalExpiresAt: { gt: new Date() },
      },
    })
  }

  /**
   * Fetches ALL pending requests across an organizer's non-deleted trips.
   * Includes trip context (id, title, slug) for FE grouping.
   * Used by: TripService.getAllPendingRequests()
   * No pagination — pending requests are low-volume by nature.
   */
  async findAllPendingForOrganizer(organizerId: string) {
    return this.prisma.tripRequest.findMany({
      where: {
        status: 'PENDING',
        isDeleted: false,
        trip: { organizerId, isDeleted: false },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        ...REQUEST_INCLUDE_LIST,
        trip: { select: { id: true, title: true, slug: true } },
      },
    })
  }

  /**
   * Creates a new trip request with nested TravelerDetail rows.
   *
   * Used by: TripService.createTripRequest()
   * Edge case: Prisma throws P2002 if @@unique(tripId, userId) violated
   */
  async create(data: {
    tripId: string
    userId: string
    numTravelers: number
    message?: string
    travelers?: Array<{
      name: string; phone: string; age: number; gender: string
      isPrimary: boolean; emergencyContactName?: string; emergencyContactPhone?: string
    }>
  }) {
    return this.prisma.tripRequest.create({
      data: {
        tripId: data.tripId,
        userId: data.userId,
        numTravelers: data.numTravelers,
        message: data.message ?? null,
        ...(data.travelers?.length && {
          travelerDetails: {
            create: data.travelers.map((t) => ({
              name: t.name,
              phone: t.phone,
              age: t.age,
              gender: t.gender as Gender,
              isPrimary: t.isPrimary,
              emergencyContactName: t.emergencyContactName,
              emergencyContactPhone: t.emergencyContactPhone,
            })),
          },
        }),
      },
      include: REQUEST_INCLUDE_LIST,
    })
  }

  /**
   * Finds active trip requests (PENDING or APPROVED non-expired) for a traveler.
   * Used on the "Requests" tab of My Bookings.
   *
   * WHERE: userId, status IN (PENDING, APPROVED), isDeleted=false
   *   - APPROVED must have approvalExpiresAt > now
   * Include: trip context + travelerDetails relation
   * Used by: BookingService.getMyPendingPaymentRequests()
   */
  async findPendingPaymentForUser(userId: string) {
    return this.prisma.tripRequest.findMany({
      where: {
        userId,
        isDeleted: false,
        OR: [
          { status: 'PENDING' },
          { status: 'APPROVED', approvalExpiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        travelerDetails: TRAVELER_DETAIL_SELECT,
        trip: {
          select: {
            id: true,
            title: true,
            slug: true,
            startDate: true,
            endDate: true,
            photos: true,
            pricePerPerson: true,
            destination: { select: { id: true, name: true, slug: true } },
            organizer: { select: { id: true, businessName: true, verificationStatus: true } },
          },
        },
      },
    })
  }

  /**
   * Marks a trip request as CONVERTED and links it to the created booking.
   * Defensive: only updates if current status is APPROVED (prevents race with expiry cron).
   *
   * Used by: BookingService.confirmBooking() — after payment confirmed
   */
  async markConverted(id: string, bookingId: string) {
    return this.prisma.tripRequest.update({
      where: { id, status: 'APPROVED' },
      data: { status: 'CONVERTED', bookingId },
    })
  }

  /**
   * Counts active trip requests (PENDING or APPROVED non-expired) for a user.
   * Used for the "Requests" badge count on My Bookings.
   *
   * Used by: BookingService.getMyBookingSummary()
   */
  async countPendingPaymentForUser(userId: string): Promise<number> {
    return this.prisma.tripRequest.count({
      where: {
        userId,
        isDeleted: false,
        OR: [
          { status: 'PENDING' },
          { status: 'APPROVED', approvalExpiresAt: { gt: new Date() } },
        ],
      },
    })
  }

  // Builds dynamic WHERE clause for status + user name search
  private buildWhere(
    tripId: string,
    filters: TripRequestFilters,
  ): Prisma.TripRequestWhereInput {
    return {
      tripId,
      isDeleted: false,
      ...(filters.status && {
        status: filters.status as Prisma.EnumTripRequestStatusFilter,
      }),
      ...(filters.search && {
        user: {
          name: { contains: filters.search, mode: 'insensitive' as const },
        },
      }),
    }
  }
}
