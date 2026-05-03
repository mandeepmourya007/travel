import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class DestinationRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findAll(includeInactive = false) {
    return this.prisma.destination.findMany({
      where: {
        isDeleted: false,
        ...(includeInactive ? {} : { isActive: true }),
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
}
