import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema } from '@shared/validators/auth.schema'

describe('signupSchema', () => {
  const validPayload = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password1',
    role: 'TRAVELER' as const,
  }

  it('passes with valid traveler data', () => {
    const result = signupSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('passes with valid organizer data', () => {
    const result = signupSchema.safeParse({ ...validPayload, role: 'ORGANIZER' })
    expect(result.success).toBe(true)
  })

  it('passes with optional phone', () => {
    const result = signupSchema.safeParse({ ...validPayload, phone: '9876543210' })
    expect(result.success).toBe(true)
  })

  it('lowercases email', () => {
    const result = signupSchema.parse({ ...validPayload, email: 'John@Example.COM' })
    expect(result.email).toBe('john@example.com')
  })

  it('trims name', () => {
    const result = signupSchema.parse({ ...validPayload, name: '  John Doe  ' })
    expect(result.name).toBe('John Doe')
  })

  it('rejects name shorter than 2 chars', () => {
    const result = signupSchema.safeParse({ ...validPayload, name: 'J' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({ ...validPayload, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects password without uppercase', () => {
    const result = signupSchema.safeParse({ ...validPayload, password: 'password1' })
    expect(result.success).toBe(false)
  })

  it('rejects password without lowercase', () => {
    const result = signupSchema.safeParse({ ...validPayload, password: 'PASSWORD1' })
    expect(result.success).toBe(false)
  })

  it('rejects password without number', () => {
    const result = signupSchema.safeParse({ ...validPayload, password: 'Password' })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 8 chars', () => {
    const result = signupSchema.safeParse({ ...validPayload, password: 'Pass1' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = signupSchema.safeParse({ ...validPayload, role: 'ADMIN' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid Indian phone number', () => {
    const result = signupSchema.safeParse({ ...validPayload, phone: '1234567890' })
    expect(result.success).toBe(false)
  })

  it('rejects phone with wrong length', () => {
    const result = signupSchema.safeParse({ ...validPayload, phone: '98765' })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = signupSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('passes with valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'john@example.com', password: 'any' })
    expect(result.success).toBe(true)
  })

  it('lowercases email', () => {
    const result = loginSchema.parse({ email: 'John@Example.COM', password: 'any' })
    expect(result.email).toBe('john@example.com')
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'bad', password: 'any' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'john@example.com', password: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const result = loginSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
