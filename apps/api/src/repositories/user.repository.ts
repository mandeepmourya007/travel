import { Prisma } from '@prisma/client'
import type { UserRole } from '@shared/constants/roles'
import type { AdminTravellerFilters } from '@shared/types/admin.types'
import { ADMIN_TRAVELLER_SORT, ADMIN_TRAVELLER_STATUS } from '@shared/constants/admin'
import { SORT_ORDER } from '@shared/constants/sort'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class UserRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findFirst({ where: { googleId } })
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } })
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return []
    return this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
  }

  async create(data: {
    name: string
    email?: string
    phone?: string
    passwordHash?: string
    googleId?: string
    role: 'TRAVELER' | 'ORGANIZER'
    avatarUrl?: string
    phoneVerified?: boolean
    emailVerified?: boolean
    tncAcceptedAt?: Date
  }) {
    return this.prisma.user.create({ data })
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })
  }

  /**
   * Updates user profile fields (name, role, avatarUrl).
   * Used by: AuthService.updateProfile
   */
  async updateProfile(id: string, data: { name?: string; role?: 'TRAVELER' | 'ORGANIZER'; avatarUrl?: string }) {
    return this.prisma.user.update({ where: { id }, data })
  }

  /**
   * Flips isReseller=true. Idempotent — a no-op update if already true.
   * Used by: ResellerService.generateMainLink (the resellerEmail match flips this flag).
   */
  async setResellerFlag(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { isReseller: true } })
  }

  /**
   * Links a Google account to an existing user by setting their googleId.
   * Optionally sets avatarUrl if provided (used when user has no existing avatar).
   * Used by: AuthService.googleAuth (Case B — email match, no googleId yet)
   */
  async updateGoogleId(userId: string, googleId: string, avatarUrl?: string) {
    const data: { googleId: string; avatarUrl?: string } = { googleId }
    if (avatarUrl) data.avatarUrl = avatarUrl
    return this.prisma.user.update({ where: { id: userId }, data })
  }

  /**
   * Attaches + verifies a phone number for an already-authenticated user of any auth
   * method (email, Google, organizer-invite). Sets phoneVerified=true atomically.
   * Used by: OtpService.verifyPhoneOtpForAttach
   */
  async setPhone(id: string, phone: string) {
    return this.prisma.user.update({ where: { id }, data: { phone, phoneVerified: true } })
  }

  /**
   * Attaches + verifies an email for an already-authenticated user of any auth
   * method (phone, Google, organizer-invite). Sets emailVerified=true atomically.
   * Used by: OtpService.verifyEmailOtpForAttach
   */
  async setEmail(id: string, email: string) {
    return this.prisma.user.update({ where: { id }, data: { email, emailVerified: true } })
  }

  /**
   * Marks the account's existing email as verified without changing it —
   * used when an external IdP (Google) has already confirmed ownership.
   * Used by: AuthService.googleAuth
   */
  async markEmailVerified(id: string) {
    return this.prisma.user.update({ where: { id }, data: { emailVerified: true } })
  }

  /**
   * Fetches user with organizer profile included (1-to-1 relation).
   * Used by: AuthService.getFullProfile
   * Note: soft-delete check on organizerProfile done in service layer
   * (Prisma 1-to-1 relations don't support nested where).
   */
  async findWithOrganizer(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        organizerProfile: {
          select: {
            id: true,
            slug: true,
            businessName: true,
            description: true,
            verificationStatus: true,
            rating: true,
            totalReviews: true,
            totalTripsCompleted: true,
            bankAccountLinked: true,
            cashfreeVendorId: true,
            razorpayAccountId: true,
            documents: true,
            isDeleted: true,
            documentReviews: {
              select: { id: true, docType: true, status: true, currentUrl: true, reviewedAt: true, reviewedBy: true },
              orderBy: { docType: 'asc' as const },
            },
          },
        },
      },
    })
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    })
    return !!user
  }

  /** Count all non-deleted users. Used by: AdminService.getPlatformStats() */
  async countAll(): Promise<number> {
    return this.prisma.user.count({ where: { isDeleted: false } })
  }

  /** Count users by role. Used by: AdminService.getPlatformStats() */
  async countByRole(role: UserRole): Promise<number> {
    return this.prisma.user.count({ where: { role, isDeleted: false } })
  }

  /** Find user IDs + emails by role. Used by: NotificationService (admin notifications) */
  async findByRole(role: UserRole): Promise<Array<{ id: string; email: string | null }>> {
    return this.prisma.user.findMany({
      where: { role, isDeleted: false },
      select: { id: true, email: true },
    })
  }

  /**
   * All active users with a verified phone, capped at limit rows.
   * Caller checks length against WHATSAPP_PROMO_MAX_RECIPIENTS before proceeding.
   */
  async findAllWithVerifiedPhone(limit?: number): Promise<Array<{ id: string; phone: string }>> {
    const rows = await this.prisma.user.findMany({
      where: { phone: { not: null }, phoneVerified: true, isActive: true, isDeleted: false },
      select: { id: true, phone: true },
      ...(limit !== undefined ? { take: limit } : {}),
    })
    return rows.filter((r): r is { id: string; phone: string } => r.phone !== null)
  }

  /**
   * Active users of a given role with a verified phone, capped at limit rows.
   * Caller checks length against WHATSAPP_PROMO_MAX_RECIPIENTS before proceeding.
   */
  async findByRoleWithVerifiedPhone(role: UserRole, limit?: number): Promise<Array<{ id: string; phone: string }>> {
    const rows = await this.prisma.user.findMany({
      where: { role, phone: { not: null }, phoneVerified: true, isActive: true, isDeleted: false },
      select: { id: true, phone: true },
      ...(limit !== undefined ? { take: limit } : {}),
    })
    return rows.filter((r): r is { id: string; phone: string } => r.phone !== null)
  }

  /** Soft-delete a user by id. Intercepted by Prisma extension → sets isDeleted=true. */
  async deleteById(id: string) {
    return this.prisma.user.delete({ where: { id } })
  }

  /**
   * Paginated traveller directory for admin. ILIKE search across name/email/phone.
   * Sorting on bookingsCount uses the `_count` aggregate orderBy.
   * Used by: AdminService.getTravellerList()
   */
  async findAllAdmin(
    filters: AdminTravellerFilters,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      ...(filters.status && { isActive: filters.status === ADMIN_TRAVELLER_STATUS.ACTIVE }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { email: { contains: filters.search, mode: 'insensitive' as const } },
          { phone: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const dir = filters.sortOrder === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC
    let orderBy: Prisma.UserOrderByWithRelationInput
    switch (filters.sortBy) {
      case ADMIN_TRAVELLER_SORT.NAME:
        orderBy = { name: dir }
        break
      case ADMIN_TRAVELLER_SORT.BOOKINGS_COUNT:
        orderBy = { bookings: { _count: dir } }
        break
      default:
        orderBy = { createdAt: dir }
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          _count: { select: { bookings: { where: { isDeleted: false } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ])

    return { data, total }
  }

  /**
   * Single user profile for the admin traveller detail view.
   * Used by: AdminService.getTravellerDetail()
   */
  async findByIdAdmin(id: string) {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { bookings: { where: { isDeleted: false } } } },
      },
    })
  }
}
