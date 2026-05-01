import { PrismaClient, Prisma } from '@prisma/client'

export class OrganizerProfileRepository {
  constructor(private prisma: PrismaClient) {}

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

  async incrementTripCount(id: string) {
    return this.prisma.organizerProfile.update({
      where: { id },
      data: { totalTripsCompleted: { increment: 1 } },
    })
  }
}
