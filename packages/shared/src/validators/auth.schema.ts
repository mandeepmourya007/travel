import { z } from 'zod'

/** 10-digit Indian phone number starting with 6-9. Shared across FE + BE. */
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  phone: z
    .string()
    .regex(INDIAN_PHONE_REGEX, 'Invalid Indian phone number')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['TRAVELER', 'ORGANIZER']),
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

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
})
