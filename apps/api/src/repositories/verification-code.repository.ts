import type { VerificationCodeType } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class VerificationCodeRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /** Stores a new verification code (hashed). */
  async create(data: {
    userId?: string
    type: VerificationCodeType
    identifier: string
    codeHash: string
    expiresAt: Date
  }) {
    return this.prisma.verificationCode.create({ data })
  }

  /**
   * Gets the most recent UNUSED code for an identifier+type (ordered by createdAt desc).
   * Note: Expiry is checked in the service layer, not here.
   * Used by: OtpService.sendOtp() (cooldown check), OtpService.verifyOtp()
   */
  async findLatestByIdentifier(identifier: string, type: VerificationCodeType) {
    return this.prisma.verificationCode.findFirst({
      where: {
        identifier,
        type,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** Bumps attempt counter. Used by: OtpService.verifyOtp() on wrong OTP. */
  async incrementAttempts(id: string) {
    return this.prisma.verificationCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  /** Marks code as used. Used by: OtpService.verifyOtp() on correct OTP. */
  async markUsed(id: string) {
    return this.prisma.verificationCode.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  }

  /** Invalidates all active codes for an identifier. Used by: OtpService.sendOtp() before sending new code. */
  async invalidateExisting(identifier: string, type: VerificationCodeType) {
    return this.prisma.verificationCode.updateMany({
      where: { identifier, type, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  /**
   * Counts codes sent in the last N minutes for an identifier.
   * Used by: OtpService.sendOtp() for rate limiting (max 3 per 10 min).
   */
  async countRecentByIdentifier(identifier: string, type: VerificationCodeType, minutesAgo: number): Promise<number> {
    return this.prisma.verificationCode.count({
      where: {
        identifier,
        type,
        createdAt: { gte: new Date(Date.now() - minutesAgo * 60 * 1000) },
      },
    })
  }

  /** Deletes codes expired more than 24h ago. Used by: cron cleanup job. */
  async deleteExpired() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return this.prisma.verificationCode.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    })
  }
}
