import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HealthService } from '../../../src/services/health.service'
import { HEALTH_CHECK_TIMEOUT_MS } from '../../../src/utils/constants'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

/** A connectivity check that never resolves — simulates a hung third party. */
function hangs(): Promise<never> {
  return new Promise(() => {})
}

function upCheck() {
  return vi.fn().mockResolvedValue({ status: 'up' as const })
}

function fakeConnectivityCheckService(overrides: Partial<Record<'checkCloudinary' | 'checkPaymentGateway' | 'checkResend' | 'checkMsg91', ReturnType<typeof vi.fn>>> = {}) {
  return {
    checkCloudinary: overrides.checkCloudinary ?? upCheck(),
    checkPaymentGateway: overrides.checkPaymentGateway ?? upCheck(),
    checkResend: overrides.checkResend ?? upCheck(),
    checkMsg91: overrides.checkMsg91 ?? upCheck(),
  }
}

describe('HealthService.getReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves within HEALTH_CHECK_TIMEOUT_MS and reports a hung check as down, not throwing or hanging', async () => {
    const connectivityCheckService = fakeConnectivityCheckService({
      checkPaymentGateway: vi.fn(() => hangs()),
    })

    const service = new HealthService(connectivityCheckService as any, mockLogger as any)

    const resultPromise = service.getReadiness()
    // Flush the timer race without waiting real wall-clock time.
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS)
    const result = await resultPromise

    expect(result.checks.paymentGateway).toBe('down')
    expect(result.detail.paymentGateway).toContain('timed out')
    expect(result.detail.paymentGateway).toContain(String(HEALTH_CHECK_TIMEOUT_MS))
    // Unaffected checks still resolved normally.
    expect(result.checks.cloudinary).toBe('up')
    expect(result.checks.resend).toBe('up')
    expect(result.checks.msg91).toBe('up')
    expect(result.status).toBe('degraded')
  })

  it('does not let a hung check block the other three checks from resolving promptly', async () => {
    const connectivityCheckService = fakeConnectivityCheckService({
      checkCloudinary: vi.fn(() => hangs()),
    })

    const service = new HealthService(connectivityCheckService as any, mockLogger as any)

    const resultPromise = service.getReadiness()
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS)
    const result = await resultPromise

    expect(result.checks.cloudinary).toBe('down')
    expect(result.checks.paymentGateway).toBe('up')
  })

  it('reports down (not a rejection) when a check throws synchronously instead of hanging', async () => {
    const connectivityCheckService = fakeConnectivityCheckService({
      checkCloudinary: vi.fn().mockRejectedValue(new Error('boom')),
    })

    const service = new HealthService(connectivityCheckService as any, mockLogger as any)

    const result = await service.getReadiness()

    expect(result.checks.cloudinary).toBe('down')
    expect(result.detail.cloudinary).toContain('threw unexpectedly')
  })

  it('reports healthy when every check is up', async () => {
    const connectivityCheckService = fakeConnectivityCheckService()

    const service = new HealthService(connectivityCheckService as any, mockLogger as any)

    const result = await service.getReadiness()
    expect(result.status).toBe('healthy')
  })
})
