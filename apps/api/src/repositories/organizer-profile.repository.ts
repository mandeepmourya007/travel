import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class OrganizerProfileRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findById(id: string) {
    return this.prisma.organizerProfile.findFirst({
      where: { id, isDeleted: false },
    })
  }

  async findByUserId(userId: string) {
    return this.prisma.organizerProfile.findFirst({
      where: { userId, isDeleted: false },
    })
  }

  async create(data: Prisma.OrganizerProfileCreateInput) {
    return this.prisma.organizerProfile.create({ data })
  }

  async update(id: string, data: Prisma.OrganizerProfileUpdateInput) {
    return this.prisma.organizerProfile.update({
      where: { id },
      data,
    })
  }

  async findByIdPublic(id: string) {
    return this.prisma.organizerProfile.findFirst({
      where: { id, isDeleted: false, verificationStatus: 'APPROVED' },
      select: {
        id: true,
        businessName: true,
        description: true,
        verificationStatus: true,
        rating: true,
        totalReviews: true,
        totalTripsCompleted: true,
        createdAt: true,
        user: { select: { createdAt: true } },
      },
    })
  }

  async findIdsForSitemap(): Promise<{ id: string; updatedAt: Date }[]> {
    return this.prisma.organizerProfile.findMany({
      where: { isDeleted: false, verificationStatus: 'APPROVED' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async incrementTripCount(id: string) {
    return this.prisma.organizerProfile.update({
      where: { id },
      data: { totalTripsCompleted: { increment: 1 } },
    })
  }
}
