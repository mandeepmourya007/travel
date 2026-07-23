import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMsg91WhatsappBody, sendMsg91WhatsappTemplate } from '../../../src/providers/whatsapp/msg91-whatsapp.client'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('buildMsg91WhatsappBody', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds body_N components in order, keyed by position', () => {
    const body = buildMsg91WhatsappBody('9876543210', '9123456789', 'tpl', ['a', 'b', 'c'])

    expect(body.integrated_number).toBe('9876543210')
    expect(body.payload.template.to_and_components[0].to).toEqual(['919123456789'])
    expect(body.payload.template.to_and_components[0].components).toEqual({
      body_1: { type: 'text', value: 'a' },
      body_2: { type: 'text', value: 'b' },
      body_3: { type: 'text', value: 'c' },
    })
  })

  it('adds button_1 only when buttonUrlValue is provided', () => {
    const withButton = buildMsg91WhatsappBody('9876543210', '9123456789', 'tpl', ['1234'], '1234')
    expect(withButton.payload.template.to_and_components[0].components.button_1).toEqual({
      type: 'text', subtype: 'url', value: '1234',
    })

    const withoutButton = buildMsg91WhatsappBody('9876543210', '9123456789', 'tpl', ['1234'])
    expect(withoutButton.payload.template.to_and_components[0].components.button_1).toBeUndefined()
  })

  it('sets language.policy=deterministic and namespace=null', () => {
    const body = buildMsg91WhatsappBody('9876543210', '9123456789', 'tpl', [])
    expect(body.payload.template.language).toEqual({ code: 'en', policy: 'deterministic' })
    expect(body.payload.template.namespace).toBeNull()
  })
})

describe('sendMsg91WhatsappTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success:true on a 2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const result = await sendMsg91WhatsappTemplate('key', '9876543210', '9123456789', 'tpl', ['1234'])

    expect(result).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('sends the authkey header and the correct URL', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    await sendMsg91WhatsappTemplate('test-key', '9876543210', '9123456789', 'tpl', [])

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/')
    expect((options.headers as Record<string, string>).authkey).toBe('test-key')
  })

  it('returns status and errorBody on a non-2xx response, without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })

    const result = await sendMsg91WhatsappTemplate('key', '9876543210', '9123456789', 'tpl', [])

    expect(result).toEqual({ success: false, status: 400, errorBody: 'bad request' })
  })

  it('returns networkError instead of throwing on a fetch rejection', async () => {
    const err = new Error('network timeout')
    fetchMock.mockRejectedValue(err)

    const result = await sendMsg91WhatsappTemplate('key', '9876543210', '9123456789', 'tpl', [])

    expect(result).toEqual({ success: false, networkError: err })
  })

  it('never logs — pure transport, callers own logging', async () => {
    // No logger is passed in at all; this test documents that omission is intentional.
    fetchMock.mockResolvedValue({ ok: true })
    await expect(
      sendMsg91WhatsappTemplate('key', '9876543210', '9123456789', 'tpl', []),
    ).resolves.toEqual({ success: true })
  })
})
