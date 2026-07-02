import type { UserRole } from '@shared/constants/roles'
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

  /** Soft-delete a user by id. Intercepted by Prisma extension → sets isDeleted=true. */
  async deleteById(id: string) {
    return this.prisma.user.delete({ where: { id } })
  }
}
