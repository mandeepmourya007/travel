import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WhatsappNotificationProvider } from '../../../src/providers/whatsapp/whatsapp-notification.provider'
import type { NotificationPayload } from '../../../src/providers/notification-channel.interface'

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const templateMap: Partial<Record<string, string>> = {
  BOOKING_CONFIRMED: 'booking_confirmed_tpl',
  PAYMENT_RECEIVED: 'payment_received_tpl',
}

const provider = new WhatsappNotificationProvider(
  'test-auth-key',
  '9876543210',
  templateMap,
  mockLogger as any,
)

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    userId: 'user-1',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed',
    body: 'Your booking is confirmed',
    phone: '9123456789',
    data: { tripName: 'Goa Trip', bookingId: 'bk-001' },
    ...overrides,
  }
}

describe('WhatsappNotificationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('send', () => {
    it('returns failure when payload has no phone', async () => {
      const result = await provider.send(makePayload({ phone: undefined }))
      expect(result.success).toBe(false)
      expect(result.failureReason).toBe('No phone number')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns failure and warns when no template configured for type', async () => {
      const result = await provider.send(makePayload({ type: 'CHAT_MESSAGE' as any }))
      expect(result.success).toBe(false)
      expect(result.failureReason).toBe('No template configured')
      expect(mockLogger.warn).toHaveBeenCalledOnce()
    })

    it('calls MSG91 API and returns success on 200', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      const result = await provider.send(makePayload())

      expect(result).toEqual({ channel: 'WHATSAPP', success: true })
      expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('sends correct template name and phone prefix', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      await provider.send(makePayload())

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/')
      const body = JSON.parse(options.body as string)
      expect(body.payload.template.name).toBe('booking_confirmed_tpl')
      expect(body.payload.template.to_and_components[0].to).toEqual(['919123456789'])
      // businessNumber is used as-is (already includes its own country code) — never re-prefixed
      expect(body.integrated_number).toBe('9876543210')
    })

    it('builds correct body components for BOOKING_CONFIRMED', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      await provider.send(makePayload({ data: { tripName: 'Kerala Tour', bookingId: 'BK123' } }))

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      const components = body.payload.template.to_and_components[0].components
      expect(components).toEqual({
        body_1: { type: 'text', value: 'Kerala Tour' },
        body_2: { type: 'text', value: 'BK123' },
      })
    })

    it('returns failure and logs error on non-2xx API response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'error' })

      const result = await provider.send(makePayload())

      expect(result.success).toBe(false)
      expect(result.failureReason).toBe('MSG91 API error')
      expect(mockLogger.error).toHaveBeenCalledOnce()
    })

    it('returns failure on network error', async () => {
      fetchMock.mockRejectedValue(new Error('network failure'))

      const result = await provider.send(makePayload())

      expect(result.success).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledOnce()
    })
  })

  describe('sendPromo', () => {
    it('calls MSG91 API with caller-supplied template and params', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      const result = await provider.sendPromo('9123456789', 'promo_tpl', ['10% off', 'Manali'])

      expect(result).toEqual({ channel: 'WHATSAPP', success: true })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.payload.template.name).toBe('promo_tpl')
      expect(body.payload.template.to_and_components[0].components).toEqual({
        body_1: { type: 'text', value: '10% off' },
        body_2: { type: 'text', value: 'Manali' },
      })
    })

    it('returns failure on API error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' })

      const result = await provider.sendPromo('9123456789', 'promo_tpl', [])

      expect(result.success).toBe(false)
    })

    it('sends an empty components object when params are empty', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      await provider.sendPromo('9123456789', 'simple_tpl', [])

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.payload.template.to_and_components[0].components).toEqual({})
    })
  })
})
