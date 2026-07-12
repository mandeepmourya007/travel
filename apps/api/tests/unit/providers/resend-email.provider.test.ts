import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResendEmailProvider } from '../../../src/providers/resend-email.provider'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}))

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('ResendEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMock.mockResolvedValue({ error: null })
  })

  it('sends with the default reply-to and a List-Unsubscribe header pointing at it', async () => {
    const provider = new ResendEmailProvider('api-key', 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'support@safarnama.store',
        headers: { 'List-Unsubscribe': '<mailto:support@safarnama.store>' },
      }),
    )
  })

  it('lets a per-message replyTo override the provider default', async () => {
    const provider = new ResendEmailProvider('api-key', 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>', replyTo: 'other@safarnama.store' })

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'other@safarnama.store',
        headers: { 'List-Unsubscribe': '<mailto:other@safarnama.store>' },
      }),
    )
  })

  it('merges per-message headers on top of the List-Unsubscribe default', async () => {
    const provider = new ResendEmailProvider('api-key', 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>', headers: { 'X-Custom': '1' } })

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'List-Unsubscribe': '<mailto:support@safarnama.store>', 'X-Custom': '1' },
      }),
    )
  })

  it('returns failure when Resend reports an error', async () => {
    sendMock.mockResolvedValue({ error: { message: 'bad domain' } })
    const provider = new ResendEmailProvider('api-key', 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    const result = await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })

    expect(result.success).toBe(false)
    expect(result.error).toEqual({ message: 'bad domain' })
  })
})
