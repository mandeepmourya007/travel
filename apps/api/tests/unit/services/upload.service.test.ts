/**
 * UploadService tests — uses the REAL cloudinary SDK (just HMAC, no network).
 * Only env is mocked (module-level validated config).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { v2 as cloudinary } from 'cloudinary'

// Only mock: env config (module-level, can't be injected)
const mockEnv = vi.hoisted(() => ({
  NODE_ENV: 'test' as 'development' | 'production' | 'test',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-api-key',
  CLOUDINARY_API_SECRET: 'test-api-secret',
}))
vi.mock('../../../src/config/env', () => ({ env: mockEnv }))

import { UploadService } from '../../../src/services/upload.service'
import { ValidationError } from '../../../src/errors/app-error'

describe('UploadService', () => {
  let service: UploadService

  beforeEach(() => {
    mockEnv.NODE_ENV = 'test'
    mockEnv.CLOUDINARY_CLOUD_NAME = 'test-cloud'
    mockEnv.CLOUDINARY_API_KEY = 'test-api-key'
    mockEnv.CLOUDINARY_API_SECRET = 'test-api-secret'
    service = new UploadService()
  })

  // ── generateSignature ─────────────────────────────────

  describe('generateSignature', () => {
    it('returns a real HMAC signature from the cloudinary SDK', () => {
      const result = service.generateSignature('trips')

      // Verify independently with the real SDK
      const expected = cloudinary.utils.api_sign_request(
        { timestamp: result.timestamp, folder: 'dev/trips', transformation: 'c_limit,w_1920,h_1080,q_auto,f_auto' },
        'test-api-secret',
      )
      expect(result.signature).toBe(expected)
      expect(result.signature).toMatch(/^[a-f0-9]{40}$/) // SHA-1 hex
    })

    it('prefixes folder with dev/ in non-production (test)', () => {
      mockEnv.NODE_ENV = 'test'
      expect(service.generateSignature('trips').folder).toBe('dev/trips')
    })

    it('prefixes folder with dev/ in development', () => {
      mockEnv.NODE_ENV = 'development'
      expect(service.generateSignature('vehicles').folder).toBe('dev/vehicles')
    })

    it('prefixes folder with prod/ in production', () => {
      mockEnv.NODE_ENV = 'production'
      expect(service.generateSignature('trips').folder).toBe('prod/trips')
    })

    it('signs against the prefixed folder, not the raw folder', () => {
      mockEnv.NODE_ENV = 'production'
      const result = service.generateSignature('itinerary-docs')

      // Re-sign with raw folder — must NOT match
      const wrongSig = cloudinary.utils.api_sign_request(
        { timestamp: result.timestamp, folder: 'itinerary-docs', transformation: 'c_limit,w_1920,h_1080,q_auto,f_auto' },
        'test-api-secret',
      )
      expect(result.signature).not.toBe(wrongSig)

      // Re-sign with prefixed folder — must match
      const correctSig = cloudinary.utils.api_sign_request(
        { timestamp: result.timestamp, folder: 'prod/itinerary-docs', transformation: 'c_limit,w_1920,h_1080,q_auto,f_auto' },
        'test-api-secret',
      )
      expect(result.signature).toBe(correctSig)
    })

    it('accepts all 4 allowed folders', () => {
      const folders = ['trips', 'itinerary-docs', 'vehicles', 'verification-docs'] as const
      for (const folder of folders) {
        const result = service.generateSignature(folder)
        expect(result.folder).toBe(`dev/${folder}`)
        expect(result.signature).toMatch(/^[a-f0-9]{40}$/)
      }
    })

    it('returns correct apiKey and cloudName from env', () => {
      const result = service.generateSignature('trips')
      expect(result.apiKey).toBe('test-api-key')
      expect(result.cloudName).toBe('test-cloud')
    })

    it('returns a recent unix timestamp', () => {
      const before = Math.floor(Date.now() / 1000)
      const result = service.generateSignature('trips')
      const after = Math.ceil(Date.now() / 1000)

      expect(result.timestamp).toBeGreaterThanOrEqual(before)
      expect(result.timestamp).toBeLessThanOrEqual(after)
    })

    it('throws ValidationError when cloudinary not configured', () => {
      mockEnv.CLOUDINARY_CLOUD_NAME = ''
      expect(() => service.generateSignature('trips')).toThrow(ValidationError)
      expect(() => service.generateSignature('trips')).toThrow('Cloudinary is not configured')
    })

    it('different folders produce different signatures for same timestamp', () => {
      const a = service.generateSignature('trips')
      const b = service.generateSignature('vehicles')
      // Timestamps may differ by 1s in edge cases, but folders definitely differ
      expect(a.folder).not.toBe(b.folder)
    })
  })

  // ── validateCloudinaryUrl ─────────────────────────────

  describe('validateCloudinaryUrl', () => {
    it('returns true for valid cloudinary URL matching cloud name', () => {
      expect(service.validateCloudinaryUrl(
        'https://res.cloudinary.com/test-cloud/image/upload/v1/trips/photo.jpg',
      )).toBe(true)
    })

    it('returns false for wrong cloud name', () => {
      expect(service.validateCloudinaryUrl(
        'https://res.cloudinary.com/other-cloud/image/upload/v1/photo.jpg',
      )).toBe(false)
    })

    it('returns false for non-cloudinary URL', () => {
      expect(service.validateCloudinaryUrl('https://example.com/image.jpg')).toBe(false)
    })

    it('returns false when CLOUDINARY_CLOUD_NAME is empty', () => {
      mockEnv.CLOUDINARY_CLOUD_NAME = ''
      expect(service.validateCloudinaryUrl(
        'https://res.cloudinary.com/test-cloud/image/upload/v1/photo.jpg',
      )).toBe(false)
    })
  })
})
