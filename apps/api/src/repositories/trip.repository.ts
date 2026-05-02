import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient, TransactionClient } from '../lib/prisma'
import type { TripFilters } from '@shared/types/trip.types'

const TRIP_INCLUDE_SUMMARY = {
  destination: {
    select: { id: true, name: true, slug: true },
  },
  organizer: {
    select: {
      id: true,
      businessName: true,
      rating: true,
      totalReviews: true,
      verificationStatus: true,
    },
  },
} as const

const TRIP_INCLUDE_DETAIL = {
  ...TRIP_INCLUDE_SUMMARY,
  reviews: {
    where: { isDeleted: false },
    select: {
      id: true,
      overallRating: true,
      comment: true,
      createdAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
} as const

export class TripRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn)
  }

  async search(filters: TripFilters, pagination: { offset: number; limit: number }) {
    const where = this.buildWhere(filters)
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: this.buildOrderBy(filters.sort),
        include: TRIP_INCLUDE_SUMMARY,
      }),
      this.prisma.trip.count({ where }),
    ])
    return { data, total }
  }

  async findById(id: string) {
    return this.prisma.trip.findFirst({
      where: { id, isDeleted: false },
      include: TRIP_INCLUDE_DETAIL,
    })
  }

  async findBySlug(slug: string) {
    return this.prisma.trip.findFirst({
      where: { slug, isDeleted: false },
      include: TRIP_INCLUDE_DETAIL,
    })
  }

  async findByOrganizerId(organizerId: string, status?: string) {
    return this.prisma.trip.findMany({
      where: {
        organizerId,
        isDeleted: false,
        ...(status && { status: status as Prisma.EnumTripStatusFilter }),
      },
      include: TRIP_INCLUDE_SUMMARY,
      orderBy: { createdAt: 'desc' },
    })
  }

  async slugExists(slug: string) {
    const count = await this.prisma.trip.count({ where: { slug } })
    return count > 0
  }

  async create(data: Prisma.TripCreateInput) {
    return this.prisma.trip.create({
      data,
      include: TRIP_INCLUDE_SUMMARY,
    })
  }

  async update(id: string, data: Prisma.TripUpdateInput) {
    return this.prisma.trip.update({
      where: { id },
      data,
      include: TRIP_INCLUDE_SUMMARY,
    })
  }

  async softDelete(id: string) {
    return this.prisma.trip.update({
      where: { id },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() },
    })
  }

  private buildWhere(filters: TripFilters): Prisma.TripWhereInput {
    return {
      isDeleted: false,
      status: 'ACTIVE',
      ...(filters.destinationId && { destinationId: filters.destinationId }),
      ...(filters.destination && {
        destination: { name: { contains: filters.destination, mode: 'insensitive' as const } },
      }),
      ...(filters.bookingMode && { bookingMode: filters.bookingMode as Prisma.EnumBookingModeFilter }),
      ...(filters.tripType && { tripType: filters.tripType as Prisma.EnumTripTypeFilter }),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            pricePerPerson: {
              ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
              ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
            },
          }
        : {}),
      ...(filters.startDate && { startDate: { gte: new Date(filters.startDate) } }),
    }
  }

  private buildOrderBy(sort?: string): Prisma.TripOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { pricePerPerson: 'asc' }
      case 'price_desc':
        return { pricePerPerson: 'desc' }
      case 'rating':
        return { organizer: { rating: 'desc' } }
      case 'popularity':
        return { currentBookings: 'desc' }
      case 'date':
      default:
        return { startDate: 'asc' }
    }
  }
}
