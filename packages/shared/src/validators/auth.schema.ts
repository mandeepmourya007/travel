import { z } from 'zod'
import { SIGNUP_ROLES, USER_ROLE } from '../constants/roles'
import { CASHFREE_ACCOUNT_TYPES } from '../constants/payment'

/** 10-digit Indian phone number starting with 6-9. Shared across FE + BE. */
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/

/** Basic email format validation. Shared across FE + BE. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Shared "must be checked" error for consent checkboxes — see `acceptedTermsField`/`acceptedOrganizerAgreementField`. */
const consentErrorMap = (message: string) => ({ errorMap: () => ({ message }) })

/** Shared error message for missing/false Organizer Agreement consent — reused by every schema that can create/switch-to an ORGANIZER. */
export const ORGANIZER_AGREEMENT_ERROR = 'You must accept the Organizer Agreement'

/** Traveler-facing Terms of Service + Privacy Policy consent, required on every traveler signup variant. */
export const acceptedTermsField = z.literal(
  true,
  consentErrorMap('You must accept the Terms of Service and Privacy Policy'),
)

/** Organizer Agreement consent, required only when completing organizer registration. */
export const acceptedOrganizerAgreementField = z.literal(
  true,
  consentErrorMap(ORGANIZER_AGREEMENT_ERROR),
)

/**
 * Requires `acceptedOrganizerAgreement: true` whenever `role === 'ORGANIZER'` is submitted.
 * Shared refinement for any schema that can create an OrganizerProfile from a role field
 * (password signup, self-serve role switch) — organizerSignupSchema's invite flow doesn't
 * need this since role there is implicit and acceptedOrganizerAgreementField is already required.
 */
function requireOrganizerAgreementForOrganizerRole(
  data: { role?: string; acceptedOrganizerAgreement?: boolean },
  ctx: z.RefinementCtx,
) {
  if (data.role === USER_ROLE.ORGANIZER && data.acceptedOrganizerAgreement !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: ORGANIZER_AGREEMENT_ERROR,
      path: ['acceptedOrganizerAgreement'],
    })
  }
}

export const signupSchema = z
  .object({
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
    acceptedTerms: acceptedTermsField,
    acceptedOrganizerAgreement: z.boolean().optional(),
  })
  .superRefine(requireOrganizerAgreementForOrganizerRole)

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

export const updateProfileSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
    role: z.enum(SIGNUP_ROLES).optional(),
    acceptedOrganizerAgreement: z.boolean().optional(),
  })
  .superRefine(requireOrganizerAgreementForOrganizerRole)

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
  // Only enforced for signup — existing users logging back in already accepted
  // terms previously (see AuthService.googleAuth's new-user branch).
  acceptedTerms: z.boolean().optional(),
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
  acceptedOrganizerAgreement: acceptedOrganizerAgreementField,
})
