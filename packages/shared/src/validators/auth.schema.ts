import { z } from 'zod'
import { SIGNUP_ROLES } from '../constants/roles'
import { CASHFREE_ACCOUNT_TYPES } from '../constants/payment'

/** 10-digit Indian phone number starting with 6-9. Shared across FE + BE. */
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/

/** Basic email format validation. Shared across FE + BE. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const signupSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  phone: z
    .string()
    .regex(INDIAN_PHONE_REGEX, 'Invalid Indian phone number')
    .optional(),
  role: z.enum(SIGNUP_ROLES).optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

export const sendOtpSchema = z.object({
  phone: z.string().regex(INDIAN_PHONE_REGEX, 'Invalid Indian phone number'),
})

export const verifyOtpSchema = z.object({
  phone: z.string().regex(INDIAN_PHONE_REGEX, 'Invalid Indian phone number'),
  otp: z.string().length(4, 'OTP must be 4 digits').regex(/^\d{4}$/, 'OTP must be numeric'),
})

export const firebaseVerifySchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
})

export const sendEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
})

export const verifyEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  otp: z.string().length(4, 'OTP must be 4 digits').regex(/^\d{4}$/, 'OTP must be numeric'),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  role: z.enum(SIGNUP_ROLES).optional(),
})

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
})

export const organizerDocumentsSchema = z.object({
  aadhaarFront: z.string().url('Invalid Aadhaar front URL').or(z.literal('')).optional(),
  aadhaarBack: z.string().url('Invalid Aadhaar back URL').or(z.literal('')).optional(),
  panCard: z.string().url('Invalid PAN card URL').or(z.literal('')).optional(),
})

export const updateOrganizerProfileSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100).trim().optional(),
  description: z.string().max(500, 'Description too long').trim().optional(),
  documents: organizerDocumentsSchema.optional(),
})

/** IFSC format: 4 uppercase letters + 0 + 6 alphanumeric chars */
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

/** Indian PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F) */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export const connectBankAccountSchema = z.object({
  accountHolderName: z.string().trim().min(2, 'Account holder name is required').max(120),
  ifscCode: z.string().trim().toUpperCase().regex(IFSC_REGEX, 'Invalid IFSC code (e.g. SBIN0001234)'),
  accountNumber: z.string().trim().min(9, 'Account number too short').max(18, 'Account number too long').regex(/^\d+$/, 'Account number must be numeric'),
  beneficiaryName: z.string().trim().min(2, 'Beneficiary name is required').max(120),
  pan: z.string().trim().toUpperCase().regex(PAN_REGEX, 'Invalid PAN (e.g. ABCDE1234F)').optional(),
  accountType: z.enum(CASHFREE_ACCOUNT_TYPES).optional(),
})

export const organizerInviteSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
})

export const organizerSignupSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  phone: z
    .string()
    .regex(INDIAN_PHONE_REGEX, 'Invalid Indian phone number')
    .optional(),
})
