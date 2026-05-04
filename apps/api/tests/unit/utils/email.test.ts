import { describe, it, expect } from 'vitest'
import { normalizeEmail } from '../../../src/utils/email'

describe('normalizeEmail', () => {
  it('should normalize a valid email to lowercase and trimmed', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com')
  })

  it('should return normalized email for a basic valid email', () => {
    expect(normalizeEmail('test@gmail.com')).toBe('test@gmail.com')
  })

  it('should return null for an empty string', () => {
    expect(normalizeEmail('')).toBeNull()
  })

  it('should return null for whitespace-only string', () => {
    expect(normalizeEmail('   ')).toBeNull()
  })

  it('should return null for missing @', () => {
    expect(normalizeEmail('userexample.com')).toBeNull()
  })

  it('should return null for missing domain', () => {
    expect(normalizeEmail('user@')).toBeNull()
  })

  it('should return null for missing local part', () => {
    expect(normalizeEmail('@example.com')).toBeNull()
  })

  it('should return null for email with spaces in middle', () => {
    expect(normalizeEmail('user @example.com')).toBeNull()
  })

  it('should handle plus-addressed emails', () => {
    expect(normalizeEmail('user+tag@example.com')).toBe('user+tag@example.com')
  })

  it('should handle subdomains', () => {
    expect(normalizeEmail('user@mail.example.co.in')).toBe('user@mail.example.co.in')
  })
})
