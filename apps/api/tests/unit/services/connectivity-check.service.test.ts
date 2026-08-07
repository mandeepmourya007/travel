import { describe, it, expect, vi, beforeEach } from 'vitest'
import { v2 as cloudinary } from 'cloudinary'
import { ConnectivityCheckService, type ConnectivityCheckServiceConfig } from '../../../src/services/connectivity-check.service'
import { PAYMENT_PROVIDER } from '@shared/constants'

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const resendSendMock = vi.fn()
const resendListDomainsMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: resendSendMock },
    domains: { list: resendListDomainsMock },
  })),
}))

function baseConfig(overrides: Partial<ConnectivityCheckServiceConfig> = {}): ConnectivityCheckServiceConfig {
  return {
    cloudinary: { cloudName: 'test-cloud', apiKey: 'test-key', apiSecret: 'test-secret' },
    paymentGateway: {
      provider: PAYMENT_PROVIDER.RAZORPAY,
      razorpay: { keyId: 'rzp_test_key', keySecret: 'test-secret' },
      cashfree: null,
    },
    email: { kind: 'resend', apiKey: 'test-resend-key' },
    otp: { kind: 'msg91', authKey: 'test-auth-key' },
    ...overrides,
  }
}

describe('ConnectivityCheckService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── checkMsg91 ────────────────────────────────────────
  // Regression coverage for the readiness probe never leaking the raw MSG91 account
  // balance — this is a full standalone reimplementation of the balance-check fetch
  // (not delegating to msg91-otp.provider.ts's checkMsg91Balance), so it needs its own
  // leak-prevention coverage independent of tests/unit/providers/msg91-otp.provider.test.ts.
  describe('checkMsg91', () => {
    it('returns skipped when the active OTP channel is mock', async () => {
      const service = new ConnectivityCheckService(baseConfig({ otp: { kind: 'mock' } }), mockLogger as any)
      const result = await service.checkMsg91()
      expect(result.status).toBe('skipped')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('never leaks the raw balance value in detail when balance is healthy', async () => {
      const distinctiveBalance = '4271.83'
      fetchMock.mockResolvedValue({ ok: true, text: async () => distinctiveBalance })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkMsg91()

      expect(result.status).toBe('up')
      expect(JSON.stringify(result)).not.toContain(distinctiveBalance)
      expect(mockLogger.info).toHaveBeenCalledWith({ balance: 4271.83 }, expect.any(String))
    })

    it('never leaks the raw balance value when the balance is low', async () => {
      const distinctiveLowBalance = '3.14'
      fetchMock.mockResolvedValue({ ok: true, text: async () => distinctiveLowBalance })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkMsg91()

      expect(result.status).toBe('up')
      expect(result.detail).toBe('MSG91 balance is low — top up soon')
      expect(JSON.stringify(result)).not.toContain(distinctiveLowBalance)
    })

    it('returns down without leaking the response body on a non-OK HTTP status', async () => {
      const sensitiveBody = 'account-id-98213-suspended'
      fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => sensitiveBody })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkMsg91()

      expect(result.status).toBe('down')
      expect(result.detail).not.toContain(sensitiveBody)
      expect(result.detail).toContain('HTTP 401')
    })

    it('returns down on a network error without leaking the error message', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED internal-msg91-proxy.corp:443'))
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkMsg91()

      expect(result.status).toBe('down')
      expect(result.detail).toBe('Network error reaching MSG91 API')
      expect(result.detail).not.toContain('internal-msg91-proxy')
    })

    // E3: negative balance must still trip the low-balance floor (balance < FLOOR is
    // true for any negative number), not be mistaken for a parse failure.
    it('returns up with a low-balance detail when balance is negative', async () => {
      const negativeBalance = '-5'
      fetchMock.mockResolvedValue({ ok: true, text: async () => negativeBalance })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkMsg91()

      expect(result.status).toBe('up')
      expect(result.detail).toBe('MSG91 balance is low — top up soon')
      expect(JSON.stringify(result)).not.toContain(negativeBalance)
    })

    // H1: the outer HealthService.safeCheck race (5s) is useless if the underlying
    // fetch has no signal of its own — the request keeps running server-side after
    // the race already resolved. Assert every fetch() call here is abortable.
    it('passes an AbortSignal (bounded by HEALTH_CHECK_TIMEOUT_MS) to fetch', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: async () => '100' })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      await service.checkMsg91()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    })
  })

  // ── checkResend ───────────────────────────────────────
  describe('checkResend', () => {
    it('returns skipped when the active email channel is not resend', async () => {
      const service = new ConnectivityCheckService(baseConfig({ email: { kind: 'mock' } }), mockLogger as any)
      const result = await service.checkResend()
      expect(result.status).toBe('skipped')
    })

    it('returns up when a verified sending domain exists', async () => {
      resendListDomainsMock.mockResolvedValue({ data: { data: [{ status: 'verified' }] }, error: null })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkResend()

      expect(result.status).toBe('up')
    })

    it('returns a fixed detail string on an SDK error — never the raw SDK error message', async () => {
      const sensitiveErrorMessage = 'API key re_internal_8827a for account acct_39281 is invalid'
      resendListDomainsMock.mockResolvedValue({ data: null, error: { message: sensitiveErrorMessage } })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkResend()

      expect(result.status).toBe('down')
      expect(result.detail).toBe('Resend API key rejected')
      expect(result.detail).not.toContain(sensitiveErrorMessage)
      expect(JSON.stringify(result)).not.toContain('acct_39281')
    })

    it('returns a fixed detail string on a thrown network error — never the raw error message', async () => {
      const sensitiveErrorMessage = 'getaddrinfo ENOTFOUND internal-resend-proxy.corp'
      resendListDomainsMock.mockRejectedValue(new Error(sensitiveErrorMessage))
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkResend()

      expect(result.status).toBe('down')
      expect(result.detail).toBe('Network error reaching Resend API')
      expect(result.detail).not.toContain(sensitiveErrorMessage)
    })
  })

  // ── checkCloudinary ───────────────────────────────────
  describe('checkCloudinary', () => {
    it('returns skipped when Cloudinary is not configured', async () => {
      const service = new ConnectivityCheckService(baseConfig({ cloudinary: null }), mockLogger as any)
      const result = await service.checkCloudinary()
      expect(result.status).toBe('skipped')
    })

    it('returns up when cloudinary.api.ping succeeds', async () => {
      vi.spyOn(cloudinary.api, 'ping').mockResolvedValue({ status: 'ok' } as any)
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkCloudinary()

      expect(result.status).toBe('up')
    })

    it('returns a fixed detail string when ping throws — never the raw SDK error message', async () => {
      const sensitiveErrorMessage = 'Invalid cloud_name acct-internal-88213 or api_secret sk_live_xyz'
      vi.spyOn(cloudinary.api, 'ping').mockRejectedValue(new Error(sensitiveErrorMessage))
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkCloudinary()

      expect(result.status).toBe('down')
      expect(result.detail).toBe('Cloudinary credentials rejected or ping failed')
      expect(result.detail).not.toContain(sensitiveErrorMessage)
      expect(JSON.stringify(result)).not.toContain('acct-internal-88213')
    })
  })

  // ── checkPaymentGateway ───────────────────────────────
  describe('checkPaymentGateway', () => {
    it('returns down for Razorpay on a 401 (bad credentials)', async () => {
      fetchMock.mockResolvedValue({ status: 401 })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkPaymentGateway()

      expect(result.status).toBe('down')
    })

    it('returns up for Razorpay on a 404 (auth accepted, order not found)', async () => {
      fetchMock.mockResolvedValue({ status: 404 })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const result = await service.checkPaymentGateway()

      expect(result.status).toBe('up')
    })

    it('returns down for Cashfree on a 401 (bad credentials)', async () => {
      fetchMock.mockResolvedValue({ status: 401 })
      const service = new ConnectivityCheckService(
        baseConfig({
          paymentGateway: {
            provider: PAYMENT_PROVIDER.CASHFREE,
            razorpay: null,
            cashfree: { appId: 'app', secretKey: 'secret', webhookSecret: 'wh', baseUrl: 'https://sandbox.cashfree.com/pg', apiVersion: '2025-01-01', environment: 'sandbox' },
          },
        }),
        mockLogger as any,
      )

      const result = await service.checkPaymentGateway()

      expect(result.status).toBe('down')
    })

    // H1: same abortable-fetch requirement as checkMsg91 above, for both gateways.
    it('passes an AbortSignal to fetch for Razorpay', async () => {
      fetchMock.mockResolvedValue({ status: 404 })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      await service.checkPaymentGateway()

      expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    })

    it('passes an AbortSignal to fetch for Cashfree', async () => {
      fetchMock.mockResolvedValue({ status: 404 })
      const service = new ConnectivityCheckService(
        baseConfig({
          paymentGateway: {
            provider: PAYMENT_PROVIDER.CASHFREE,
            razorpay: null,
            cashfree: { appId: 'app', secretKey: 'secret', webhookSecret: 'wh', baseUrl: 'https://sandbox.cashfree.com/pg', apiVersion: '2025-01-01', environment: 'sandbox' },
          },
        }),
        mockLogger as any,
      )

      await service.checkPaymentGateway()

      expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    })

    // H1 edge case: AbortSignal.timeout firing (simulated by a hanging fetch whose
    // signal is aborted) must resolve to the existing 'down' shape via the normal
    // catch block, not throw or leak a different error message. No real sleep —
    // the mock implementation aborts and rejects the returned promise immediately.
    it('resolves to down without leaking the abort error when the fetch signal aborts', async () => {
      fetchMock.mockImplementation((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal!.reason ?? new DOMException('The operation was aborted.', 'TimeoutError'))
          })
        })
      })
      const service = new ConnectivityCheckService(baseConfig(), mockLogger as any)

      const resultPromise = service.checkPaymentGateway()
      // Fire the abort synchronously instead of waiting out the real timeout.
      const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal
      signal.dispatchEvent(new Event('abort'))

      const result = await resultPromise

      expect(result).toEqual({ status: 'down', detail: 'Network error reaching Razorpay API' })
    })
  })
})
