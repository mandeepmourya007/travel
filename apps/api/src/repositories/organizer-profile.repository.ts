import { Prisma } from '@prisma/client'
import type { VerificationStatus } from '@shared/constants/verification-status'
import type { ExtendedPrismaClient } from '../lib/prisma'

const PUBLIC_PROFILE_SELECT = {
  id: true,
  slug: true,
  businessName: true,
  description: true,
  verificationStatus: true,
  rating: true,
  totalReviews: true,
  totalTripsCompleted: true,
  createdAt: true,
  user: { select: { createdAt: true } },
} as const

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
      select: PUBLIC_PROFILE_SELECT,
    })
  }

  async findBySlugPublic(slug: string) {
    return this.prisma.organizerProfile.findFirst({
      where: { slug, isDeleted: false, verificationStatus: 'APPROVED' },
      select: PUBLIC_PROFILE_SELECT,
    })
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.organizerProfile.count({ where: { slug } })
    return count > 0
  }

  async findIdsForSitemap(): Promise<{ id: string; slug: string; updatedAt: Date }[]> {
    return this.prisma.organizerProfile.findMany({
      where: { isDeleted: false, verificationStatus: 'APPROVED' },
      select: { id: true, slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async incrementTripCount(id: string) {
    return this.prisma.organizerProfile.update({
      where: { id },
      data: { totalTripsCompleted: { increment: 1 } },
    })
  }

  /**
   * Paginated list of organizer profiles for admin approval queue.
   * Joins user (name, email, avatarUrl). Filters by verificationStatus.
   * Used by: AdminService.getApprovalQueue()
   */
  async findAllAdmin(
    filters: { status?: VerificationStatus },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.OrganizerProfileWhereInput = {
      isDeleted: false,
      ...(filters.status && { verificationStatus: filters.status }),
    }

    const [data, total] = await Promise.all([
      this.prisma.organizerProfile.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          businessName: true,
          description: true,
          documents: true,
          verificationStatus: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          documentReviews: {
            select: { id: true, docType: true, status: true, currentUrl: true, reviewedAt: true, reviewedBy: true },
            orderBy: { docType: 'asc' },
          },
        },
      }),
      this.prisma.organizerProfile.count({ where }),
    ])

    return { data, total }
  }

  /**
   * Single organizer profile with full details for admin review.
   * Used by: AdminService.getOrganizerDetail()
   */
  async findByIdAdmin(id: string) {
    return this.prisma.organizerProfile.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        userId: true,
        businessName: true,
        description: true,
        documents: true,
        verificationStatus: true,
        rating: true,
        totalReviews: true,
        totalTripsCompleted: true,
        commissionRate: true,
        bankAccountLinked: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true, createdAt: true },
        },
        documentReviews: {
          select: { id: true, docType: true, status: true, currentUrl: true, reviewedAt: true, reviewedBy: true },
          orderBy: { docType: 'asc' },
        },
        reviewComments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  }

  /**
   * Atomic conditional update — only sets bank fields when bankAccountLinked is still false.
   * Returns { count: 0 } if another request already linked the account (race-safe).
   */
  async updateWhereBankNotLinked(id: string, data: { razorpayAccountId: string; bankAccountLinked: true }) {
    return this.prisma.organizerProfile.updateMany({
      where: { id, bankAccountLinked: false },
      data,
    })
  }

  /** Count pending organizer approvals. Used by: AdminService.getPlatformStats() */
  async countPending(): Promise<number> {
    return this.prisma.organizerProfile.count({
      where: { verificationStatus: 'PENDING', isDeleted: false },
    })
  }
}
