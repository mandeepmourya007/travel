import { EMAIL_REGEX } from '@shared/validators/auth.schema'

/**
 * Normalizes and validates an email address.
 * Trims whitespace, lowercases, and checks format.
 * Returns the normalized email or null if invalid.
 */
export function normalizeEmail(raw: string): string | null {
  const email = raw.toLowerCase().trim()
  return email && EMAIL_REGEX.test(email) ? email : null
}
