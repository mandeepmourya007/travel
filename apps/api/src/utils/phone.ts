/**
 * Normalizes Indian phone numbers to 10-digit format.
 * Strips +91, 91, 0 prefix. Returns null if invalid after normalization.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  let digits = cleaned
  if (digits.startsWith('+91')) digits = digits.slice(3)
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}
