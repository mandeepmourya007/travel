import { describe, it, expect } from 'vitest'
import {
  signupSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  updateProfileSchema,
  googleAuthSchema,
  organizerDocumentsSchema,
  updateOrganizerProfileSchema,
  connectBankAccountSchema,
  organizerSignupSchema,
} from '@shared/validators/auth.schema'

describe('signupSchema', () => {
  const validPayload = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password1',
    role: 'TRAVELER' as const,
    acceptedTerms: true as const,
  }

  it('passes with valid traveler data', () => {
    const result = signupSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('passes with valid organizer data', () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      role: 'ORGANIZER',
      acceptedOrganizerAgreement: true,
    })
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
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'Password1',
      acceptedTerms: true,
    })
    expect(result.success).toBe(true)
  })

  it('returns undefined for role when not provided', () => {
    const result = signupSchema.parse({
      email: 'a@b.com',
      password: 'Password1',
      acceptedTerms: true,
    })
    expect(result.role).toBeUndefined()
  })

  it('rejects when acceptedTerms is missing', () => {
    const { acceptedTerms, ...rest } = validPayload
    const result = signupSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects when acceptedTerms is false', () => {
    const result = signupSchema.safeParse({ ...validPayload, acceptedTerms: false })
    expect(result.success).toBe(false)
  })

  it('passes with role ORGANIZER and acceptedOrganizerAgreement true', () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      role: 'ORGANIZER',
      acceptedOrganizerAgreement: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects role ORGANIZER with acceptedOrganizerAgreement false', () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      role: 'ORGANIZER',
      acceptedOrganizerAgreement: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'acceptedOrganizerAgreement')).toBe(true)
    }
  })

  it('rejects role ORGANIZER with acceptedOrganizerAgreement omitted', () => {
    const result = signupSchema.safeParse({ ...validPayload, role: 'ORGANIZER' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'acceptedOrganizerAgreement')).toBe(true)
    }
  })

  it('does not require acceptedOrganizerAgreement for role TRAVELER', () => {
    const result = signupSchema.safeParse({ ...validPayload, role: 'TRAVELER' })
    expect(result.success).toBe(true)
  })
})

describe('organizerSignupSchema', () => {
  const validPayload = {
    password: 'Password1',
    name: 'Jane Doe',
    acceptedOrganizerAgreement: true as const,
  }

  it('passes with valid data', () => {
    expect(organizerSignupSchema.safeParse(validPayload).success).toBe(true)
  })

  it('rejects when acceptedOrganizerAgreement is missing', () => {
    const { acceptedOrganizerAgreement, ...rest } = validPayload
    expect(organizerSignupSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects when acceptedOrganizerAgreement is false', () => {
    expect(
      organizerSignupSchema.safeParse({ ...validPayload, acceptedOrganizerAgreement: false }).success,
    ).toBe(false)
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

  it('should accept name with valid role when acceptedOrganizerAgreement is true', () => {
    expect(
      updateProfileSchema.safeParse({ name: 'AB', role: 'ORGANIZER', acceptedOrganizerAgreement: true }).success,
    ).toBe(true)
  })

  it('should accept name without role', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB' }).success).toBe(true)
  })

  it('should reject invalid role', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB', role: 'ADMIN' }).success).toBe(false)
  })

  it('rejects role ORGANIZER with acceptedOrganizerAgreement false', () => {
    const result = updateProfileSchema.safeParse({ name: 'AB', role: 'ORGANIZER', acceptedOrganizerAgreement: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'acceptedOrganizerAgreement')).toBe(true)
    }
  })

  it('rejects role ORGANIZER with acceptedOrganizerAgreement omitted', () => {
    const result = updateProfileSchema.safeParse({ name: 'AB', role: 'ORGANIZER' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'acceptedOrganizerAgreement')).toBe(true)
    }
  })

  it('does not require acceptedOrganizerAgreement for role TRAVELER', () => {
    expect(updateProfileSchema.safeParse({ name: 'AB', role: 'TRAVELER' }).success).toBe(true)
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

describe('organizerDocumentsSchema', () => {
  it('accepts valid URLs for all fields', () => {
    const result = organizerDocumentsSchema.safeParse({
      aadhaarFront: 'https://res.cloudinary.com/demo/image/upload/aadhaar-front.jpg',
      aadhaarBack: 'https://res.cloudinary.com/demo/image/upload/aadhaar-back.jpg',
      panCard: 'https://res.cloudinary.com/demo/image/upload/pan.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    expect(organizerDocumentsSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a subset of fields', () => {
    const result = organizerDocumentsSchema.safeParse({
      aadhaarFront: 'https://example.com/front.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty string for clearing a field', () => {
    const result = organizerDocumentsSchema.safeParse({ aadhaarFront: '' })
    expect(result.success).toBe(true)
  })

  it('rejects non-URL non-empty strings', () => {
    const result = organizerDocumentsSchema.safeParse({ aadhaarFront: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects numeric values', () => {
    const result = organizerDocumentsSchema.safeParse({ panCard: 12345 })
    expect(result.success).toBe(false)
  })
})

describe('updateOrganizerProfileSchema', () => {
  it('accepts businessName + description + documents', () => {
    const result = updateOrganizerProfileSchema.safeParse({
      businessName: 'Trek India',
      description: 'Best treks in India',
      documents: { aadhaarFront: 'https://example.com/aadhaar.jpg' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts documents only', () => {
    const result = updateOrganizerProfileSchema.safeParse({
      documents: { panCard: 'https://example.com/pan.jpg' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    expect(updateOrganizerProfileSchema.safeParse({}).success).toBe(true)
  })

  it('rejects too-short businessName', () => {
    const result = updateOrganizerProfileSchema.safeParse({ businessName: 'X' })
    expect(result.success).toBe(false)
  })

  it('rejects description over 500 chars', () => {
    const result = updateOrganizerProfileSchema.safeParse({ description: 'A'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('trims businessName whitespace', () => {
    const result = updateOrganizerProfileSchema.parse({ businessName: '  Trek India  ' })
    expect(result.businessName).toBe('Trek India')
  })
})

describe('connectBankAccountSchema', () => {
  const validPayload = {
    accountHolderName: 'Rahul Sharma',
    ifscCode: 'SBIN0001234',
    accountNumber: '12345678901234',
    beneficiaryName: 'Rahul Sharma',
  }

  it('passes with valid bank details', () => {
    const result = connectBankAccountSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('uppercases IFSC code', () => {
    const result = connectBankAccountSchema.parse({ ...validPayload, ifscCode: 'sbin0001234' })
    expect(result.ifscCode).toBe('SBIN0001234')
  })

  it('trims all string fields', () => {
    const result = connectBankAccountSchema.parse({
      ...validPayload,
      accountHolderName: '  Rahul Sharma  ',
      beneficiaryName: '  Rahul  ',
      ifscCode: ' SBIN0001234 ',
      accountNumber: ' 12345678901234 ',
    })
    expect(result.accountHolderName).toBe('Rahul Sharma')
    expect(result.beneficiaryName).toBe('Rahul')
    expect(result.ifscCode).toBe('SBIN0001234')
    expect(result.accountNumber).toBe('12345678901234')
  })

  it('rejects invalid IFSC format', () => {
    expect(connectBankAccountSchema.safeParse({ ...validPayload, ifscCode: 'INVALID' }).success).toBe(false)
    expect(connectBankAccountSchema.safeParse({ ...validPayload, ifscCode: '12340001234' }).success).toBe(false)
  })

  it('rejects non-numeric account number', () => {
    expect(connectBankAccountSchema.safeParse({ ...validPayload, accountNumber: 'ABC123' }).success).toBe(false)
  })

  it('rejects account number too short', () => {
    expect(connectBankAccountSchema.safeParse({ ...validPayload, accountNumber: '12345678' }).success).toBe(false)
  })

  it('rejects account number too long', () => {
    expect(connectBankAccountSchema.safeParse({ ...validPayload, accountNumber: '1234567890123456789' }).success).toBe(false)
  })

  it('rejects too-short accountHolderName', () => {
    expect(connectBankAccountSchema.safeParse({ ...validPayload, accountHolderName: 'R' }).success).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(connectBankAccountSchema.safeParse({}).success).toBe(false)
    expect(connectBankAccountSchema.safeParse({ accountHolderName: 'Rahul' }).success).toBe(false)
  })
})
