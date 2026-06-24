import type { ExtendedPrismaClient } from '../lib/prisma'

export class OrganizerInviteRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async upsert(email: string, token: string, sentBy?: string) {
    return this.prisma.organizerInvite.upsert({
      where: { email },
      create: { email, token, sentAt: new Date(), sentBy: sentBy ?? null },
      update: { token, sentAt: new Date(), acceptedAt: null, sentBy: sentBy ?? undefined },
    })
  }

  async markAccepted(email: string) {
    return this.prisma.organizerInvite.updateMany({
      where: { email, acceptedAt: null },
      data: { acceptedAt: new Date() },
    })
  }

  async findAll(
    filter: { status?: 'pending' | 'accepted' },
    pagination: { skip: number; take: number },
  ) {
    const where =
      filter.status === 'pending'
        ? { acceptedAt: null }
        : filter.status === 'accepted'
          ? { acceptedAt: { not: null } }
          : {}

    const [data, total] = await Promise.all([
      this.prisma.organizerInvite.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          sentByUser: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.organizerInvite.count({ where }),
    ])

    return { data, total }
  }

  async findByEmail(email: string) {
    return this.prisma.organizerInvite.findUnique({ where: { email } })
  }
}
