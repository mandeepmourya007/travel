import type { Logger } from 'pino'
import type { WhatsappBroadcastRepository, BroadcastPaginationFilters } from '../repositories/whatsapp-broadcast.repository'
import type { UserRepository } from '../repositories/user.repository'
import type { WhatsappNotificationProvider } from '../providers/whatsapp'
import { ValidationError, AppError } from '../errors/app-error'
import { BROADCAST_STATUS, BROADCAST_TARGET_TYPE, WHATSAPP_PROMO_MAX_RECIPIENTS, WHATSAPP_PROMO_SEND_DELAY_MS } from '../providers/whatsapp'
import { paginate } from '../utils/constants'
import type { SendWhatsappPromotionDto } from '@shared/validators/admin.schema'
import { normalizePhone } from '../utils/phone'

export class WhatsappBroadcastService {
  constructor(
    private broadcastRepo: WhatsappBroadcastRepository,
    private userRepo: UserRepository,
    private whatsappProvider: WhatsappNotificationProvider | null,
    private logger: Logger,
  ) {}

  async sendPromotion(adminId: string, dto: SendWhatsappPromotionDto) {
    if (!this.whatsappProvider) {
      throw new AppError('WhatsApp provider not configured', 503, 'WHATSAPP_NOT_CONFIGURED')
    }

    // Resolve target phone list
    const phones = await this.resolvePhones(dto)

    if (phones.length === 0) {
      throw new ValidationError('No eligible recipients found for this broadcast')
    }

    if (phones.length > WHATSAPP_PROMO_MAX_RECIPIENTS) {
      throw new ValidationError(
        `Broadcast exceeds maximum recipient limit of ${WHATSAPP_PROMO_MAX_RECIPIENTS}. Got ${phones.length}.`,
      )
    }

    // Create broadcast record in PROCESSING state
    const broadcast = await this.broadcastRepo.create({
      createdByAdminId: adminId,
      message: dto.message,
      templateName: dto.templateName,
      targetType: dto.targetType,
      targetRole: dto.targetRole,
      totalCount: phones.length,
      status: BROADCAST_STATUS.PROCESSING,
    })

    this.logger.info(
      { broadcastId: broadcast.id, adminId, totalCount: phones.length, templateName: dto.templateName },
      'WhatsApp broadcast started',
    )

    let successCount = 0
    let failureCount = 0

    try {
      for (const phone of phones) {
        const result = await this.whatsappProvider.sendPromo(phone, dto.templateName, dto.params)
        if (result.success) {
          successCount++
        } else {
          failureCount++
          this.logger.warn(
            { broadcastId: broadcast.id, phone: `****${phone.slice(-4)}`, reason: result.failureReason },
            'WhatsApp broadcast message failed for recipient',
          )
        }
        // Rate-limit: stay under MSG91 burst threshold (~20 req/s)
        await new Promise<void>((r) => setTimeout(r, WHATSAPP_PROMO_SEND_DELAY_MS))
      }

      await this.broadcastRepo.updateCounts(broadcast.id, {
        successCount,
        failureCount,
        status: BROADCAST_STATUS.COMPLETED,
        completedAt: new Date(),
      })

      this.logger.info(
        { broadcastId: broadcast.id, successCount, failureCount },
        'WhatsApp broadcast completed',
      )
    } catch (err) {
      this.logger.error({ broadcastId: broadcast.id, err, successCount, failureCount }, 'WhatsApp broadcast failed unexpectedly')
      // Best-effort status update so the record never stays stuck in PROCESSING
      await this.broadcastRepo.updateCounts(broadcast.id, {
        successCount,
        failureCount,
        status: BROADCAST_STATUS.FAILED,
        completedAt: new Date(),
      }).catch((updateErr) => {
        this.logger.error({ broadcastId: broadcast.id, updateErr }, 'Failed to mark broadcast as FAILED')
      })
      throw err
    }

    return { broadcastId: broadcast.id, totalCount: phones.length, successCount, failureCount }
  }

  async getBroadcastHistory(filters: BroadcastPaginationFilters) {
    const { meta } = paginate(filters)
    const { data, total } = await this.broadcastRepo.findAll({ page: filters.page, limit: filters.limit })
    return {
      data,
      pagination: meta(total),
    }
  }

  // ── Private helpers ────────────────────────────────

  private async resolvePhones(dto: SendWhatsappPromotionDto): Promise<string[]> {
    if (dto.targetType === BROADCAST_TARGET_TYPE.PHONE_LIST) {
      // Normalize and deduplicate caller-supplied phone numbers
      const normalized = (dto.phones ?? [])
        .map((p) => normalizePhone(p))
        .filter((p): p is string => p !== null)
      return [...new Set(normalized)]
    }

    // Fetch one extra row so we can distinguish "exactly at limit" from "over limit"
    // without loading the entire table first.
    const cap = WHATSAPP_PROMO_MAX_RECIPIENTS + 1

    if (dto.targetType === BROADCAST_TARGET_TYPE.BY_ROLE && dto.targetRole) {
      const users = await this.userRepo.findByRoleWithVerifiedPhone(dto.targetRole, cap)
      return users.map((u) => u.phone)
    }

    // ALL_USERS
    const users = await this.userRepo.findAllWithVerifiedPhone(cap)
    return users.map((u) => u.phone)
  }
}
