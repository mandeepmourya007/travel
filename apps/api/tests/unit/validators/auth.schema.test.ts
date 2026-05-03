import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema, sendOtpSchema, verifyOtpSchema, updateProfileSchema, googleAuthSchema } from '@shared/validators/auth.schema'

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

  it('passes with email and password only (no name, no role)', () => {
    const result = signupSchema.safeParse({ email: 'a@b.com', password: 'Password1' })
    expect(result.success).toBe(true)
  })

  it('returns undefined for role when not provided', () => {
    const result = signupSchema.parse({ email: 'a@b.com', password: 'Password1' })
    expect(result.role).toBeUndefined()
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

describe('sendOtpSchema', () => {
  it('should accept valid 10-digit phone starting with 6-9', () => {
    expect(sendOtpSchema.safeParse({ phone: '9876543210' }).success).toBe(true)
    expect(sendOtpSchema.safeParse({ phone: '6123456789' }).success).toBe(true)
  })

  it('should reject phone with less than 10 digits', () => {
    expect(sendOtpSchema.safeParse({ phone: '98765' }).success).toBe(false)
  })

  it('should reject phone starting with 0-5', () => {
    expect(sendOtpSchema.safeParse({ phone: '1234567890' }).success).toBe(false)
  })
})

describe('verifyOtpSchema', () => {
  it('should accept valid phone + 4-digit OTP', () => {
    expect(verifyOtpSchema.safeParse({ phone: '9876543210', otp: '1234' }).success).toBe(true)
  })

  it('should reject non-numeric OTP', () => {
    expect(verifyOtpSchema.safeParse({ phone: '9876543210', otp: 'abcd' }).success).toBe(false)
  })

  it('should reject OTP with length not equal to 4', () => {
    expect(verifyOtpSchema.safeParse({ phone: '9876543210', otp: '123' }).success).toBe(false)
    expect(verifyOtpSchema.safeParse({ phone: '9876543210', otp: '12345' }).success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('should accept name with 2+ chars', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB' }).success).toBe(true)
  })

  it('should reject name with less than 2 chars', () => {
    expect(updateProfileSchema.safeParse({ name: 'A' }).success).toBe(false)
  })

  it('should reject name with more than 100 chars', () => {
    expect(updateProfileSchema.safeParse({ name: 'A'.repeat(101) }).success).toBe(false)
  })

  it('should accept name with valid role', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB', role: 'ORGANIZER' }).success).toBe(true)
  })

  it('should accept name without role', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB' }).success).toBe(true)
  })

  it('should reject invalid role', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB', role: 'ADMIN' }).success).toBe(false)
  })
})

describe('googleAuthSchema', () => {
  it('should accept valid idToken', () => {
    expect(googleAuthSchema.safeParse({ idToken: 'some-token' }).success).toBe(true)
  })

  it('should reject empty idToken', () => {
    expect(googleAuthSchema.safeParse({ idToken: '' }).success).toBe(false)
  })

  it('should reject missing idToken', () => {
    expect(googleAuthSchema.safeParse({}).success).toBe(false)
  })
})
