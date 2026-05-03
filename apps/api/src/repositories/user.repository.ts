import type { ExtendedPrismaClient } from '../lib/prisma'

export class UserRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email } })
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findFirst({ where: { googleId } })
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } })
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
   * Used by: AuthService.googleAuth (Case B — email match, no googleId yet)
   */
  async updateGoogleId(userId: string, googleId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { googleId } })
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
            businessName: true,
            description: true,
            verificationStatus: true,
            rating: true,
            totalReviews: true,
            totalTripsCompleted: true,
            bankAccountLinked: true,
            isDeleted: true,
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
}
