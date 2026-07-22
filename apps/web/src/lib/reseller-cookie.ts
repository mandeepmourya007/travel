/**
 * Tiny client-readable cookie util for the reseller `?ref` attribution token.
 * No cookie library exists in this repo's package.json (checked before adding this) —
 * a plain `document.cookie` read/write is enough for this single non-HttpOnly key.
 *
 * Security note: this cookie carries only an opaque sublink token, never a price —
 * the server always recomputes markup/effectivePrice from the token at booking time.
 */

const RESELLER_REF_COOKIE = 'reseller_ref'
const RESELLER_REF_MAX_AGE_DAYS = 30

export function getResellerRefCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${RESELLER_REF_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

export function setResellerRefCookie(token: string): void {
  if (typeof document === 'undefined') return
  const maxAgeSeconds = RESELLER_REF_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${RESELLER_REF_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}
