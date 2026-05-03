import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { TripRequestFilters } from '@shared/types/trip-request.types'

const REQUEST_INCLUDE_LIST = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
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
