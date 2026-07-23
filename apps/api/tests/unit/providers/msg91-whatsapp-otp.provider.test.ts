import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Msg91WhatsappOtpProvider } from '../../../src/providers/whatsapp/msg91-whatsapp-otp.provider'

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('Msg91WhatsappOtpProvider', () => {
  const provider = new Msg91WhatsappOtpProvider(
    'test-auth-key',
    '9876543210',
    'otp_template',
    mockLogger as any,
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendOtp', () => {
    it('returns success:true and channel:whatsapp on 200 response', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      const result = await provider.sendOtp('9123456789', '1234')

      expect(result).toEqual({ success: true, channel: 'whatsapp' })
      expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('sends the correct payload to MSG91 WhatsApp API', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      await provider.sendOtp('9123456789', '5678')

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/')
      expect((options.headers as Record<string, string>)['authkey']).toBe('test-auth-key')

      const body = JSON.parse(options.body as string)
      // businessNumber is used as-is (already includes its own country code) — never re-prefixed
      expect(body.integrated_number).toBe('9876543210')
      expect(body.payload.template.name).toBe('otp_template')
      expect(body.payload.template.language).toEqual({ code: 'en', policy: 'deterministic' })
      expect(body.payload.template.namespace).toBeNull()
      expect(body.payload.template.to_and_components[0].to).toEqual(['919123456789'])
      // otp_tripeeeh's "Copy Code" URL button needs the same OTP as button_1
      expect(body.payload.template.to_and_components[0].components).toEqual({
        body_1: { type: 'text', value: '5678' },
        button_1: { type: 'text', subtype: 'url', value: '5678' },
      })
    })

    it('returns success:false and logs error on non-2xx response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })

      const result = await provider.sendOtp('9123456789', '1234')

      expect(result).toEqual({ success: false, channel: 'whatsapp' })
      expect(mockLogger.error).toHaveBeenCalledOnce()
    })

    it('returns success:false and logs error on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('network timeout'))

      const result = await provider.sendOtp('9123456789', '1234')

      expect(result).toEqual({ success: false, channel: 'whatsapp' })
      expect(mockLogger.error).toHaveBeenCalledOnce()
    })

    it('masks all but last 4 digits of phone in logs', async () => {
      fetchMock.mockResolvedValue({ ok: true })

      await provider.sendOtp('9123456789', '1234')

      const logCall = mockLogger.info.mock.calls[0][0]
      expect(logCall.phone).toBe('****6789')
      expect(logCall.phone).not.toContain('9123')
    })
  })
})
