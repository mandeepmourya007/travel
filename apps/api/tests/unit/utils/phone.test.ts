import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../../../src/utils/phone'

describe('normalizePhone', () => {
  it('should return 10 digits for valid phone', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })

  it('should strip +91 prefix', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210')
  })

  it('should strip 91 prefix when 12 digits', () => {
    expect(normalizePhone('919876543210')).toBe('9876543210')
  })

  it('should strip 0 prefix', () => {
    expect(normalizePhone('09876543210')).toBe('9876543210')
  })

  it('should return null for invalid phone (too short)', () => {
    expect(normalizePhone('12345')).toBeNull()
  })

  it('should return null for phone starting with 0-5', () => {
    expect(normalizePhone('1234567890')).toBeNull()
    expect(normalizePhone('5234567890')).toBeNull()
  })
})
