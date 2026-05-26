import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class DestinationRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findAll(options: { includeInactive?: boolean; popular?: boolean } = {}) {
    return this.prisma.destination.findMany({
      where: {
        isDeleted: false,
        ...(options.includeInactive ? {} : { isActive: true }),
        ...(options.popular && { isPopular: true }),
      },
      orderBy: [{ isPopular: 'desc' }, { tripCount: 'desc' }, { name: 'asc' }],
    })
  }

  async findById(id: string) {
    return this.prisma.destination.findFirst({
      where: { id, isDeleted: false },
    })
  }

  async findBySlug(slug: string) {
    return this.prisma.destination.findFirst({
      where: { slug, isDeleted: false },
    })
  }

  /** Case-insensitive lookup by destination name. Used by TripService.resolveDestination. */
  async findByName(name: string) {
    return this.prisma.destination.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, isDeleted: false },
    })
  }

  async create(data: Prisma.DestinationCreateInput) {
    return this.prisma.destination.create({ data })
  }

  async update(id: string, data: Prisma.DestinationUpdateInput) {
    return this.prisma.destination.update({
      where: { id },
      data,
    })
  }

  async softDelete(id: string) {
    return this.prisma.destination.update({
      where: { id },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() },
    })
  }

  async findBySlugPublic(slug: string) {
    return this.prisma.destination.findFirst({
      where: { slug, isDeleted: false, isActive: true },
    })
  }

  async findSlugsForSitemap(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.destination.findMany({
      where: { isDeleted: false, isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async incrementTripCount(id: string) {
    return this.prisma.destination.update({
      where: { id },
      data: { tripCount: { increment: 1 } },
    })
  }

  async decrementTripCount(id: string) {
    return this.prisma.destination.update({
      where: { id },
      data: { tripCount: { decrement: 1 } },
    })
  }

  async findRelated(excludeId: string, state: string, limit = 6) {
    return this.prisma.destination.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        id: { not: excludeId },
        OR: [{ state }, { isPopular: true }],
      },
      orderBy: [{ tripCount: 'desc' }, { name: 'asc' }],
      take: limit,
    })
  }
}
