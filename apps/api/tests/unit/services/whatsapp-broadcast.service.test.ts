import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WhatsappBroadcastService } from '../../../src/services/whatsapp-broadcast.service'
import type { WhatsappBroadcastRepository } from '../../../src/repositories/whatsapp-broadcast.repository'
import type { UserRepository } from '../../../src/repositories/user.repository'
import type { WhatsappNotificationProvider } from '../../../src/providers/whatsapp'
import type { SendWhatsappPromotionDto } from '@shared/validators/admin.schema'
import { WHATSAPP_PROMO_MAX_RECIPIENTS } from '../../../src/providers/whatsapp'

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function makeRepo(): jest.Mocked<WhatsappBroadcastRepository> {
  return {
    create: vi.fn().mockResolvedValue({ id: 'broadcast-1', totalCount: 2 }),
    updateCounts: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  } as any
}

function makeUserRepo(): jest.Mocked<UserRepository> {
  return {
    findAllWithVerifiedPhone: vi.fn().mockResolvedValue([
      { id: 'u1', phone: '9000000001' },
      { id: 'u2', phone: '9000000002' },
    ]),
    findByRoleWithVerifiedPhone: vi.fn().mockResolvedValue([
      { id: 'u3', phone: '9000000003' },
    ]),
  } as any
}

function makeProvider(): jest.Mocked<WhatsappNotificationProvider> {
  return {
    sendPromo: vi.fn().mockResolvedValue({ channel: 'WHATSAPP', success: true }),
  } as any
}

function makeDto(overrides: Partial<SendWhatsappPromotionDto> = {}): SendWhatsappPromotionDto {
  return {
    templateName: 'promo_summer',
    message: 'Summer offer!',
    targetType: 'ALL_USERS',
    params: ['20% off'],
    ...overrides,
  }
}

describe('WhatsappBroadcastService', () => {
  let broadcastRepo: ReturnType<typeof makeRepo>
  let userRepo: ReturnType<typeof makeUserRepo>
  let provider: ReturnType<typeof makeProvider>
  let service: WhatsappBroadcastService

  beforeEach(() => {
    vi.clearAllMocks()
    broadcastRepo = makeRepo()
    userRepo = makeUserRepo()
    provider = makeProvider()
    service = new WhatsappBroadcastService(broadcastRepo, userRepo, provider, mockLogger as any)
  })

  describe('sendPromotion', () => {
    it('throws 503 when whatsapp provider is not configured', async () => {
      const serviceNoProvider = new WhatsappBroadcastService(broadcastRepo, userRepo, null, mockLogger as any)

      await expect(serviceNoProvider.sendPromotion('admin-1', makeDto())).rejects.toMatchObject({
        statusCode: 503,
        code: 'WHATSAPP_NOT_CONFIGURED',
      })
    })

    it('resolves ALL_USERS phones and sends to each', async () => {
      const result = await service.sendPromotion('admin-1', makeDto({ targetType: 'ALL_USERS' }))

      expect(userRepo.findAllWithVerifiedPhone).toHaveBeenCalledOnce()
      expect(provider.sendPromo).toHaveBeenCalledTimes(2)
      expect(result.totalCount).toBe(2)
      expect(result.successCount).toBe(2)
      expect(result.failureCount).toBe(0)
    })

    it('resolves BY_ROLE phones using the specified role', async () => {
      await service.sendPromotion('admin-1', makeDto({ targetType: 'BY_ROLE', targetRole: 'ORGANIZER' }))

      expect(userRepo.findByRoleWithVerifiedPhone).toHaveBeenCalledWith('ORGANIZER', WHATSAPP_PROMO_MAX_RECIPIENTS + 1)
      expect(provider.sendPromo).toHaveBeenCalledTimes(1)
    })

    it('uses normalized caller-supplied phones for PHONE_LIST target', async () => {
      const result = await service.sendPromotion('admin-1', makeDto({
        targetType: 'PHONE_LIST',
        phones: ['9111111111', '+919222222222'],
      }))

      expect(userRepo.findAllWithVerifiedPhone).not.toHaveBeenCalled()
      expect(provider.sendPromo).toHaveBeenCalledTimes(2)
      expect(result.totalCount).toBe(2)
    })

    it('deduplicates phone numbers in PHONE_LIST', async () => {
      await service.sendPromotion('admin-1', makeDto({
        targetType: 'PHONE_LIST',
        phones: ['9111111111', '9111111111'],
      }))

      expect(provider.sendPromo).toHaveBeenCalledTimes(1)
    })

    it('tracks failure count when provider fails for some recipients', async () => {
      provider.sendPromo
        .mockResolvedValueOnce({ channel: 'WHATSAPP', success: true })
        .mockResolvedValueOnce({ channel: 'WHATSAPP', success: false, failureReason: 'timeout' })

      const result = await service.sendPromotion('admin-1', makeDto())

      expect(result.successCount).toBe(1)
      expect(result.failureCount).toBe(1)
    })

    it('creates broadcast record and marks it COMPLETED on success', async () => {
      await service.sendPromotion('admin-1', makeDto())

      expect(broadcastRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdByAdminId: 'admin-1', status: 'PROCESSING' }),
      )
      expect(broadcastRepo.updateCounts).toHaveBeenCalledWith(
        'broadcast-1',
        expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
      )
    })

    it('throws ValidationError when no eligible recipients are found', async () => {
      userRepo.findAllWithVerifiedPhone.mockResolvedValue([])

      await expect(service.sendPromotion('admin-1', makeDto())).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      })
    })

    it('throws ValidationError when recipient count exceeds limit', async () => {
      const manyUsers = Array.from({ length: 501 }, (_, i) => ({
        id: `u${i}`,
        phone: `90000${String(i).padStart(5, '0')}`,
      }))
      userRepo.findAllWithVerifiedPhone.mockResolvedValue(manyUsers)

      await expect(service.sendPromotion('admin-1', makeDto())).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      })
    })
  })

  describe('getBroadcastHistory', () => {
    it('delegates to repo and returns paginated result', async () => {
      broadcastRepo.findAll.mockResolvedValue({
        data: [{ id: 'b1' } as any],
        total: 1,
      })

      const result = await service.getBroadcastHistory({ page: 1, limit: 10 })

      expect(broadcastRepo.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 })
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })
})
