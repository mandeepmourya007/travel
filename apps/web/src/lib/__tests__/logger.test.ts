import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ILogProvider } from '../logger'

// Must re-import after env manipulation, so we use dynamic import
async function loadLogger() {
  // Clear module cache to pick up env changes
  vi.resetModules()
  const mod = await import('../logger')
  return mod
}

describe('feLogger', () => {
  const originalEnv = process.env.NEXT_PUBLIC_LOG_LEVEL

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_LOG_LEVEL
    } else {
      process.env.NEXT_PUBLIC_LOG_LEVEL = originalEnv
    }
    vi.restoreAllMocks()
  })

  describe('level gating', () => {
    it('logs at debug level when LOG_LEVEL=debug', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
      const { feLogger, setLogProvider } = await loadLogger()

      const mockProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(mockProvider)

      feLogger.debug('test debug')
      expect(mockProvider.log).toHaveBeenCalledWith('debug', 'test debug', undefined)
    })

    it('suppresses debug when LOG_LEVEL=warn', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn'
      const { feLogger, setLogProvider } = await loadLogger()

      const mockProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(mockProvider)

      feLogger.debug('test debug')
      feLogger.info('test info')
      expect(mockProvider.log).not.toHaveBeenCalled()
    })

    it('allows warn and error when LOG_LEVEL=warn', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn'
      const { feLogger, setLogProvider } = await loadLogger()

      const mockProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(mockProvider)

      feLogger.warn('test warn')
      feLogger.error('test error')
      expect(mockProvider.log).toHaveBeenCalledTimes(2)
    })
  })

  describe('PII redaction', () => {
    it('redacts sensitive keys in context', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
      const { feLogger, setLogProvider } = await loadLogger()

      const mockProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(mockProvider)

      feLogger.debug('login', { email: 'user@test.com', password: 'secret123', token: 'abc' })
      expect(mockProvider.log).toHaveBeenCalledWith('debug', 'login', {
        email: 'user@test.com',
        password: '[REDACTED]',
        token: '[REDACTED]',
      })
    })

    it('is case-insensitive for key matching', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
      const { feLogger, setLogProvider } = await loadLogger()

      const mockProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(mockProvider)

      feLogger.info('auth', { Authorization: 'Bearer xyz', Cookie: 'session=abc' })
      expect(mockProvider.log).toHaveBeenCalledWith('info', 'auth', {
        Authorization: '[REDACTED]',
        Cookie: '[REDACTED]',
      })
    })

    it('passes through non-sensitive keys unchanged', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
      const { feLogger, setLogProvider } = await loadLogger()

      const mockProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(mockProvider)

      feLogger.info('event', { userId: '123', action: 'click' })
      expect(mockProvider.log).toHaveBeenCalledWith('info', 'event', {
        userId: '123',
        action: 'click',
      })
    })
  })

  describe('provider swap', () => {
    it('uses custom provider after setLogProvider()', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
      const { feLogger, setLogProvider } = await loadLogger()

      const customProvider: ILogProvider = { log: vi.fn() }
      setLogProvider(customProvider)

      feLogger.error('crash', { code: 500 })
      expect(customProvider.log).toHaveBeenCalledWith('error', 'crash', { code: 500 })
    })
  })
})
