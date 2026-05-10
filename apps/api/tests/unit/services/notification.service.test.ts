import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationService } from '../../../src/services/notification.service'
import type { INotificationChannelProvider, NotificationPayload, NotificationSendResult } from '../../../src/providers/notification-channel.interface'
import { logger } from '../../../src/utils/logger'

// ─── Mock repos ──────────────────────────────────
const mockNotificationRepo = {
  findByUserId: vi.fn(),
  countUnread: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}

const mockUserRepo = {
  findById: vi.fn(),
  findByRole: vi.fn(),
}

// ─── Mock channel providers ──────────────────────
function createMockProvider(channel: string, result?: Partial<NotificationSendResult>): INotificationChannelProvider {
  return {
    channel: channel as any,
    send: vi.fn().mockResolvedValue({
      channel,
      success: true,
      notificationId: 'notif-1',
      ...result,
    }),
  }
}

let inAppProvider: INotificationChannelProvider
let emailProvider: INotificationChannelProvider
let service: NotificationService

beforeEach(() => {
  vi.clearAllMocks()
  inAppProvider = createMockProvider('IN_APP')
  emailProvider = createMockProvider('EMAIL')
  service = new NotificationService(
    mockNotificationRepo as any,
    mockUserRepo as any,
    [inAppProvider, emailProvider],
    logger as any,
  )
})

// ─── send() ────────────────────────────────────────
describe('NotificationService.send', () => {
  const baseInput = {
    userId: 'user-1',
    type: 'BOOKING_CONFIRMED' as const,
    title: 'Booking Confirmed!',
    body: 'Your booking was confirmed.',
  }

  it('sends to default channels (IN_APP + EMAIL) for BOOKING_CONFIRMED', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })

    const results = await service.send(baseInput)

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ channel: 'IN_APP', success: true })
    expect(results[1]).toMatchObject({ channel: 'EMAIL', success: true })
    expect(inAppProvider.send).toHaveBeenCalledOnce()
    expect(emailProvider.send).toHaveBeenCalledOnce()
  })

  it('resolves user email when EMAIL channel is used and no email provided', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'user-1', email: 'resolved@example.com' })

    await service.send(baseInput)

    const emailPayload = (emailProvider.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationPayload
    expect(emailPayload.email).toBe('resolved@example.com')
  })

  it('does not resolve email when email is already provided', async () => {
    await service.send({ ...baseInput, email: 'manual@example.com' })

    expect(mockUserRepo.findById).not.toHaveBeenCalled()
    const emailPayload = (emailProvider.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationPayload
    expect(emailPayload.email).toBe('manual@example.com')
  })

  it('respects channel overrides', async () => {
    await service.send({ ...baseInput, channels: ['IN_APP'] })

    expect(inAppProvider.send).toHaveBeenCalledOnce()
    expect(emailProvider.send).not.toHaveBeenCalled()
  })

  it('returns failure for channels with no provider registered', async () => {
    const results = await service.send({ ...baseInput, channels: ['SMS'] })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      channel: 'SMS',
      success: false,
      failureReason: 'No provider for channel SMS',
    })
  })

  it('logs and returns failure when a provider throws', async () => {
    const sendMock = inAppProvider.send as ReturnType<typeof vi.fn>
    sendMock.mockRejectedValue(new Error('DB down'))

    const results = await service.send({ ...baseInput, channels: ['IN_APP'] })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      channel: 'IN_APP',
      success: false,
    })
    expect(results[0].failureReason).toContain('DB down')
  })

  it('continues other channels when one fails', async () => {
    const sendMock = inAppProvider.send as ReturnType<typeof vi.fn>
    sendMock.mockRejectedValue(new Error('fail'))
    mockUserRepo.findById.mockResolvedValue({ id: 'user-1', email: 'a@b.com' })

    const results = await service.send(baseInput)

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ channel: 'IN_APP', success: false })
    expect(results[1]).toMatchObject({ channel: 'EMAIL', success: true })
  })

  it('handles email resolution failure gracefully', async () => {
    mockUserRepo.findById.mockRejectedValue(new Error('DB error'))

    const results = await service.send(baseInput)

    // Should still send — just without email on the payload
    expect(results).toHaveLength(2)
    const emailPayload = (emailProvider.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as NotificationPayload
    expect(emailPayload.email).toBeUndefined()
  })

  it('falls back to IN_APP for unknown notification type', async () => {
    const results = await service.send({
      ...baseInput,
      type: 'UNKNOWN_TYPE' as any,
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ channel: 'IN_APP', success: true })
  })
})

// ─── sendBulk() ─────────────────────────────────────
describe('NotificationService.sendBulk', () => {
  it('sends to all users in parallel', async () => {
    const input1 = { userId: 'u1', type: 'CHAT_MESSAGE' as const, title: 't', body: 'b' }
    const input2 = { userId: 'u2', type: 'CHAT_MESSAGE' as const, title: 't', body: 'b' }

    await service.sendBulk([input1, input2])

    expect(inAppProvider.send).toHaveBeenCalledTimes(2)
  })

  it('does not throw when one user notification fails', async () => {
    const sendMock = inAppProvider.send as ReturnType<typeof vi.fn>
    sendMock
      .mockResolvedValueOnce({ channel: 'IN_APP', success: true })
      .mockRejectedValueOnce(new Error('fail'))

    await expect(
      service.sendBulk([
        { userId: 'u1', type: 'CHAT_MESSAGE' as const, title: 't', body: 'b' },
        { userId: 'u2', type: 'CHAT_MESSAGE' as const, title: 't', body: 'b' },
      ]),
    ).resolves.toBeUndefined()
  })
})

// ─── sendToAdmins() ──────────────────────────────────
describe('NotificationService.sendToAdmins', () => {
  it('fetches admin users and sends to each', async () => {
    mockUserRepo.findByRole.mockResolvedValue([
      { id: 'admin-1', email: 'admin1@example.com' },
      { id: 'admin-2', email: 'admin2@example.com' },
    ])

    await service.sendToAdmins({
      type: 'SYSTEM_ALERT' as const,
      title: 'Alert',
      body: 'System alert body',
    })

    expect(mockUserRepo.findByRole).toHaveBeenCalledWith('ADMIN')
    expect(inAppProvider.send).toHaveBeenCalledTimes(2)
  })

  it('does nothing when no admins exist', async () => {
    mockUserRepo.findByRole.mockResolvedValue([])

    await service.sendToAdmins({
      type: 'SYSTEM_ALERT' as const,
      title: 'Alert',
      body: 'Body',
    })

    expect(inAppProvider.send).not.toHaveBeenCalled()
  })

  it('swallows error if findByRole fails', async () => {
    mockUserRepo.findByRole.mockRejectedValue(new Error('DB down'))

    await expect(
      service.sendToAdmins({
        type: 'SYSTEM_ALERT' as const,
        title: 'Alert',
        body: 'Body',
      }),
    ).resolves.toBeUndefined()
  })
})

// ─── getNotifications() ──────────────────────────────
describe('NotificationService.getNotifications', () => {
  it('returns paginated notifications with serialized dates', async () => {
    const now = new Date('2025-05-10T12:00:00Z')
    mockNotificationRepo.findByUserId.mockResolvedValue({
      items: [
        {
          id: 'n1',
          userId: 'user-1',
          type: 'BOOKING_CONFIRMED',
          channel: 'IN_APP',
          title: 'Confirmed',
          body: 'Body',
          data: { key: 'value' },
          readAt: now,
          createdAt: now,
        },
      ],
      total: 1,
    })

    const result = await service.getNotifications('user-1', { page: 1, limit: 20, unreadOnly: false })

    expect(result.items[0].readAt).toBe('2025-05-10T12:00:00.000Z')
    expect(result.items[0].createdAt).toBe('2025-05-10T12:00:00.000Z')
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
  })

  it('returns null readAt for unread notifications', async () => {
    mockNotificationRepo.findByUserId.mockResolvedValue({
      items: [{
        id: 'n2', userId: 'user-1', type: 'CHAT_MESSAGE', channel: 'IN_APP',
        title: 'T', body: 'B', data: null, readAt: null, createdAt: new Date(),
      }],
      total: 1,
    })

    const result = await service.getNotifications('user-1', { page: 1, limit: 20, unreadOnly: false })
    expect(result.items[0].readAt).toBeNull()
  })
})

// ─── getUnreadCount() ────────────────────────────────
describe('NotificationService.getUnreadCount', () => {
  it('delegates to repository', async () => {
    mockNotificationRepo.countUnread.mockResolvedValue(5)

    const count = await service.getUnreadCount('user-1')

    expect(count).toBe(5)
    expect(mockNotificationRepo.countUnread).toHaveBeenCalledWith('user-1')
  })
})

// ─── markRead() / markAllRead() ─────────────────────
describe('NotificationService.markRead', () => {
  it('delegates to repository with correct params', async () => {
    await service.markRead('notif-1', 'user-1')

    expect(mockNotificationRepo.markRead).toHaveBeenCalledWith('notif-1', 'user-1')
  })
})

describe('NotificationService.markAllRead', () => {
  it('delegates to repository', async () => {
    await service.markAllRead('user-1')

    expect(mockNotificationRepo.markAllRead).toHaveBeenCalledWith('user-1')
  })
})
