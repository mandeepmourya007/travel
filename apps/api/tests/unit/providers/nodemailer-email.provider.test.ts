import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NodemailerEmailProvider } from '../../../src/providers/nodemailer-email.provider'

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }))

vi.mock('dns/promises', () => ({
  default: { resolve4: vi.fn().mockRejectedValue(new Error('no DNS in test env')) },
}))

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn().mockReturnValue({ sendMail: sendMailMock }) },
}))

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const SMTP_CONFIG = { host: 'smtp.example.com', port: 587, auth: { user: 'u', pass: 'p' } }

describe('NodemailerEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMailMock.mockResolvedValue(undefined)
  })

  it('sends with the default reply-to and a List-Unsubscribe header pointing at it', async () => {
    const provider = new NodemailerEmailProvider(SMTP_CONFIG, 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'support@safarnama.store',
        headers: { 'List-Unsubscribe': '<mailto:support@safarnama.store>' },
      }),
    )
  })

  it('lets a per-message replyTo override the provider default', async () => {
    const provider = new NodemailerEmailProvider(SMTP_CONFIG, 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>', replyTo: 'other@safarnama.store' })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'other@safarnama.store',
        headers: { 'List-Unsubscribe': '<mailto:other@safarnama.store>' },
      }),
    )
  })

  it('merges per-message headers on top of the List-Unsubscribe default', async () => {
    const provider = new NodemailerEmailProvider(SMTP_CONFIG, 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>', headers: { 'X-Custom': '1' } })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'List-Unsubscribe': '<mailto:support@safarnama.store>', 'X-Custom': '1' },
      }),
    )
  })

  it('returns failure when the SMTP transport throws', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('bad auth'), { code: 'EAUTH' }))
    const provider = new NodemailerEmailProvider(SMTP_CONFIG, 'Safarnama <noreply@safarnama.store>', 'support@safarnama.store', mockLogger as any)

    const result = await provider.sendEmail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' })

    expect(result.success).toBe(false)
    expect((result.error as Error).message).toBe('bad auth')
  })
})
