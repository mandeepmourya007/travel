/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebhookEventRepository } from '../../../src/repositories/webhook-event.repository'

// ── Mock Prisma ──────────────────────────────────────
function createMockPrisma() {
  return {
    webhookEvent: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

// ═══════════════════════════════════════════════════════
// deleteOldTerminalEvents
// ═══════════════════════════════════════════════════════

describe('WebhookEventRepository.deleteOldTerminalEvents', () => {
  let repo: WebhookEventRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>
  const cutoff = new Date('2025-01-01T00:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new WebhookEventRepository(mockPrisma as any)
  })

  it('returns 0 and makes no deleteMany call when no rows match', async () => {
    mockPrisma.webhookEvent.findMany.mockResolvedValue([])

    const count = await repo.deleteOldTerminalEvents(cutoff)

    expect(count).toBe(0)
    expect(mockPrisma.webhookEvent.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes a single batch smaller than batchSize and returns count', async () => {
    const ids = [{ id: 'wh_1' }, { id: 'wh_2' }, { id: 'wh_3' }]
    mockPrisma.webhookEvent.findMany.mockResolvedValueOnce(ids).mockResolvedValueOnce([])
    mockPrisma.webhookEvent.deleteMany.mockResolvedValue({ count: 3 })

    const count = await repo.deleteOldTerminalEvents(cutoff)

    expect(count).toBe(3)
    expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['wh_1', 'wh_2', 'wh_3'] } },
    })
  })

  it('loops across multiple batches until fewer than batchSize rows remain', async () => {
    // First batch: full (3 rows with batchSize=3)
    const batch1 = [{ id: 'wh_1' }, { id: 'wh_2' }, { id: 'wh_3' }]
    // Second batch: partial (2 rows) — signals end of data
    const batch2 = [{ id: 'wh_4' }, { id: 'wh_5' }]
    mockPrisma.webhookEvent.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([])
    mockPrisma.webhookEvent.deleteMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 })

    const count = await repo.deleteOldTerminalEvents(cutoff, 3)

    expect(count).toBe(5)
    expect(mockPrisma.webhookEvent.findMany).toHaveBeenCalledTimes(2)
    expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledTimes(2)
  })

  it('stops after exactly one findMany when first batch is already smaller than batchSize', async () => {
    const ids = Array.from({ length: 5 }, (_, i) => ({ id: `wh_${i}` }))
    mockPrisma.webhookEvent.findMany.mockResolvedValueOnce(ids).mockResolvedValueOnce([])
    mockPrisma.webhookEvent.deleteMany.mockResolvedValue({ count: 5 })

    await repo.deleteOldTerminalEvents(cutoff, 1_000) // default batchSize

    // 5 < 1000 — should stop after the first delete, not loop again
    expect(mockPrisma.webhookEvent.findMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledTimes(1)
  })

  it('queries only COMPLETED and SKIPPED statuses (not FAILED/RECEIVED/PROCESSING)', async () => {
    mockPrisma.webhookEvent.findMany.mockResolvedValue([])

    await repo.deleteOldTerminalEvents(cutoff)

    const findManyCall = mockPrisma.webhookEvent.findMany.mock.calls[0][0]
    expect(findManyCall.where.status).toEqual({
      in: ['COMPLETED', 'SKIPPED'],
    })
  })

  it('passes the cutoff date to the createdAt filter', async () => {
    mockPrisma.webhookEvent.findMany.mockResolvedValue([])

    await repo.deleteOldTerminalEvents(cutoff)

    const findManyCall = mockPrisma.webhookEvent.findMany.mock.calls[0][0]
    expect(findManyCall.where.createdAt).toEqual({ lt: cutoff })
  })

  it('respects a custom batchSize passed by the caller', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => ({ id: `wh_${i}` }))
    mockPrisma.webhookEvent.findMany.mockResolvedValueOnce(ids).mockResolvedValueOnce([])
    mockPrisma.webhookEvent.deleteMany.mockResolvedValue({ count: 50 })

    await repo.deleteOldTerminalEvents(cutoff, 50)

    const findManyCall = mockPrisma.webhookEvent.findMany.mock.calls[0][0]
    expect(findManyCall.take).toBe(50)
  })

  it('accumulates total across multiple batches', async () => {
    const makeBatch = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}_${i}` }))

    mockPrisma.webhookEvent.findMany
      .mockResolvedValueOnce(makeBatch(10, 'a'))
      .mockResolvedValueOnce(makeBatch(10, 'b'))
      .mockResolvedValueOnce(makeBatch(7, 'c'))
      .mockResolvedValueOnce([])
    mockPrisma.webhookEvent.deleteMany
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 7 })

    const count = await repo.deleteOldTerminalEvents(cutoff, 10)

    expect(count).toBe(27)
    expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledTimes(3)
  })
})
