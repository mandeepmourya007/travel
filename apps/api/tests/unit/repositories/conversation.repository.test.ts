/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { ConversationRepository } from '../../../src/repositories/conversation.repository'

// ── Helpers ──────────────────────────────────────────

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  })
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    type: 'ADMIN_SUPPORT',
    status: 'ACTIVE',
    travelerId: 'user-1',
    tripId: null,
    organizerProfileId: null,
    messages: [],
    ...overrides,
  }
}

// ── Mock Prisma ──────────────────────────────────────

function createMockPrisma() {
  return {
    conversation: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
    },
  }
}

// ═══════════════════════════════════════════════════════
// findOrCreateSupportChat — race condition handling
// ═══════════════════════════════════════════════════════

describe('ConversationRepository.findOrCreateSupportChat', () => {
  let repo: ConversationRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new ConversationRepository(mockPrisma as any)
  })

  it('returns the existing conversation without creating when one already exists', async () => {
    const existing = makeConversation()
    mockPrisma.conversation.findFirst.mockResolvedValue(existing)

    const result = await repo.findOrCreateSupportChat('user-1')

    expect(result).toBe(existing)
    expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
    expect(mockPrisma.conversation.findFirstOrThrow).not.toHaveBeenCalled()
  })

  it('creates and returns a new conversation when none exists', async () => {
    const created = makeConversation()
    mockPrisma.conversation.findFirst.mockResolvedValue(null)
    mockPrisma.conversation.create.mockResolvedValue(created)

    const result = await repo.findOrCreateSupportChat('user-1')

    expect(result).toBe(created)
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ADMIN_SUPPORT',
          travelerId: 'user-1',
          status: 'ACTIVE',
        }),
      }),
    )
  })

  describe('P2002 race condition (two concurrent requests hit findOrCreate simultaneously)', () => {
    it('re-fetches and returns the row when create throws P2002', async () => {
      const existing = makeConversation()
      mockPrisma.conversation.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.create.mockRejectedValue(makeP2002())
      mockPrisma.conversation.findFirstOrThrow.mockResolvedValue(existing)

      const result = await repo.findOrCreateSupportChat('user-1')

      expect(result).toBe(existing)
      expect(mockPrisma.conversation.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'ADMIN_SUPPORT',
            travelerId: 'user-1',
            isDeleted: false,
          }),
        }),
      )
    })

    it('does NOT swallow errors that are not P2002 (e.g. DB connection error)', async () => {
      const dbError = new Error('Connection refused')
      mockPrisma.conversation.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.create.mockRejectedValue(dbError)

      await expect(repo.findOrCreateSupportChat('user-1')).rejects.toThrow('Connection refused')
      expect(mockPrisma.conversation.findFirstOrThrow).not.toHaveBeenCalled()
    })

    it('does NOT swallow other Prisma errors (e.g. P2003 FK violation)', async () => {
      const fkError = new Prisma.PrismaClientKnownRequestError('FK constraint failed', {
        code: 'P2003',
        clientVersion: '6.0.0',
      })
      mockPrisma.conversation.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.create.mockRejectedValue(fkError)

      await expect(repo.findOrCreateSupportChat('user-1')).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      )
      expect(mockPrisma.conversation.findFirstOrThrow).not.toHaveBeenCalled()
    })
  })
})
