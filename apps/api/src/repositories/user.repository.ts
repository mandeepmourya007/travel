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

  async updateProfile(id: string, data: { name?: string }) {
    return this.prisma.user.update({ where: { id }, data })
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    })
    return !!user
  }
}
