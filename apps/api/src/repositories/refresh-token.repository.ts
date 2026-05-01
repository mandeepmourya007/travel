import type { ExtendedPrismaClient } from '../lib/prisma'

export class RefreshTokenRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async create(data: {
    userId: string
    tokenHash: string
    deviceInfo?: string | null
    ipAddress?: string | null
    expiresAt: Date
  }) {
    return this.prisma.refreshToken.create({ data })
  }

  async findByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } })
  }

  async revokeByHash(tokenHash: string) {
    return this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async deleteExpired() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: thirtyDaysAgo } },
    })
  }
}
