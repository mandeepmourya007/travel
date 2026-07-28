import crypto from 'crypto'

// RazorpayX's X-Payout-Idempotency header has a documented 36-character limit.
// Our entity IDs are UUIDv7 (36 chars alone), so any `PREFIX_${id}` concatenation
// blows past that limit and every real payout call gets rejected with
// BAD_REQUEST_ERROR. Hash the parts down to a fixed-length, well-under-the-limit
// key instead of concatenating raw IDs/timestamps.
//
// Deterministic in its inputs: same `parts` always produce the same key (true
// idempotency for retries of the same logical release), while callers that want
// a fresh key per release attempt (e.g. a new admin-triggered payout later) can
// pass a time component (e.g. `Date.now()`) as one of the parts.
const IDEMPOTENCY_KEY_LENGTH = 32

/**
 * Builds a RazorpayX-safe idempotency key by hashing (never concatenating) the given
 * parts down to IDEMPOTENCY_KEY_LENGTH hex chars — see the module docblock above for
 * why concatenation blows past RazorpayX's 36-char X-Payout-Idempotency limit.
 *
 * @param parts - Ordered pieces to derive the key from (e.g. a fixed prefix + an entity
 *   id). Same `parts` always produce the same key — pass a fresh part (e.g. a new
 *   attempt id or `Date.now()`) when a caller wants a new key for a new logical attempt.
 * @returns A deterministic, fixed-length hex string safe to use as X-Payout-Idempotency.
 */
export function buildIdempotencyKey(...parts: (string | number)[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, IDEMPOTENCY_KEY_LENGTH)
}
