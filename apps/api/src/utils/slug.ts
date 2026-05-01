/**
 * Generate a URL-friendly slug from a string.
 * e.g. "Goa Beach Getaway" → "goa-beach-getaway"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate a unique trip slug with date suffix.
 * e.g. "Goa Beach Getaway", "2025-12-06" → "goa-beach-getaway-dec-2025"
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function generateTripSlug(title: string, startDate: string): string {
  const base = generateSlug(title)
  const date = new Date(startDate)
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${base}-${month}-${year}`
}
