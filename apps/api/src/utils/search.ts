export const MAX_SEARCH_TOKENS = 10
export const MIN_TOKEN_LENGTH = 2

/**
 * Splits a free-text query into deduplicated, normalized tokens for OR-matching.
 *
 * Rules:
 * - Lowercased and split on whitespace and common delimiters (comma, semicolon, pipe)
 * - Tokens shorter than MIN_TOKEN_LENGTH are dropped (single chars / noise)
 * - Duplicates removed (case-insensitive)
 * - Result capped at MAX_SEARCH_TOKENS to prevent oversized OR clauses
 *
 * Returns [] when q is blank or all tokens are too short — callers should treat
 * an empty array as "no text filter" (show all trips).
 */
export function tokenizeQuery(q: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const raw of q.trim().split(/[\s,;|]+/)) {
    const t = raw.toLowerCase()
    if (t.length < MIN_TOKEN_LENGTH || seen.has(t)) continue
    seen.add(t)
    tokens.push(t)
    if (tokens.length === MAX_SEARCH_TOKENS) break
  }
  return tokens
}
