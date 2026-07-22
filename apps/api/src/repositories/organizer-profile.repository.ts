import { Prisma } from '@prisma/client'
import { VERIFICATION_STATUS } from '@shared/constants/verification-status'
import type { VerificationStatus } from '@shared/constants/verification-status'
import type { AdminOrganizerDirectoryFilters } from '@shared/types/admin.types'
import { ADMIN_ORGANIZER_SORT } from '@shared/constants/admin'
import { SORT_ORDER } from '@shared/constants/sort'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { PaymentProvider } from '../types/payment.types'

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
      where: { id, isDeleted: false, verificationStatus: VERIFICATION_STATUS.APPROVED },
      select: PUBLIC_PROFILE_SELECT,
    })
  }

  async findBySlugPublic(slug: string) {
    return this.prisma.organizerProfile.findFirst({
      where: { slug, isDeleted: false, verificationStatus: VERIFICATION_STATUS.APPROVED },
      select: PUBLIC_PROFILE_SELECT,
    })
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.organizerProfile.count({ where: { slug } })
    return count > 0
  }

  async findIdsForSitemap(): Promise<{ id: string; slug: string; updatedAt: Date }[]> {
    return this.prisma.organizerProfile.findMany({
      where: { isDeleted: false, verificationStatus: VERIFICATION_STATUS.APPROVED },
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
   * Used by: AdminService.getOrganizerApprovalDetail()
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
        _count: { select: { trips: { where: { isDeleted: false } } } },
      },
    })
  }

  /**
   * Atomic conditional update — persists the provider-specific account ID when not yet set.
   * CAS on the provider's own column so a gateway switch doesn't block linking the new account.
   * Returns { count: 0 } if another request already linked the account (race-safe).
   */
  async linkPayoutAccount(id: string, provider: PaymentProvider, accountId: string) {
    const col = provider === 'cashfree' ? 'cashfreeVendorId' : 'razorpayAccountId'
    return this.prisma.organizerProfile.updateMany({
      where: { id, [col]: null },
      data: { [col]: accountId, bankAccountLinked: true },
    })
  }

  /** Count pending organizer approvals. Used by: AdminService.getPlatformStats() */
  async countPending(): Promise<number> {
    return this.prisma.organizerProfile.count({
      where: { verificationStatus: VERIFICATION_STATUS.PENDING, isDeleted: false },
    })
  }

  /**
   * Paginated organizer directory for admin. ILIKE search across user name/email + businessName.
   * Optional verificationStatus filter. Sorting on tripsCount uses the `_count` aggregate orderBy.
   * Used by: AdminService.getOrganizer()
   */
  async findAllDirectory(
    filters: AdminOrganizerDirectoryFilters,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.OrganizerProfileWhereInput = {
      isDeleted: false,
      ...(filters.status && { verificationStatus: filters.status }),
      ...(filters.search && {
        OR: [
          { businessName: { contains: filters.search, mode: 'insensitive' as const } },
          { user: { name: { contains: filters.search, mode: 'insensitive' as const } } },
          { user: { email: { contains: filters.search, mode: 'insensitive' as const } } },
        ],
      }),
    }

    const dir = filters.sortOrder === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC
    let orderBy: Prisma.OrganizerProfileOrderByWithRelationInput
    switch (filters.sortBy) {
      case ADMIN_ORGANIZER_SORT.NAME:
        orderBy = { businessName: dir }
        break
      case ADMIN_ORGANIZER_SORT.TRIPS_COUNT:
        orderBy = { trips: { _count: dir } }
        break
      default:
        orderBy = { createdAt: dir }
    }

    const [data, total] = await Promise.all([
      this.prisma.organizerProfile.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy,
        select: {
          id: true,
          businessName: true,
          createdAt: true,
          user: { select: { name: true, email: true, phone: true } },
          _count: { select: { trips: { where: { isDeleted: false } } } },
        },
      }),
      this.prisma.organizerProfile.count({ where }),
    ])

    return { data, total }
  }
}
