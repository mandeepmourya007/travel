import { createHash } from 'node:crypto'

const CACHE_PREFIX = 'cache'

/**
 * Deterministic hash of an object for use in cache keys.
 * Sorts keys to ensure { a:1, b:2 } and { b:2, a:1 } produce the same hash.
 */
function hashObject(obj: Record<string, unknown>): string {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort())
  return createHash('sha256').update(sorted).digest('hex').slice(0, 12)
}

// ─── Key Builders ───────────────────────────────────

export const cacheKeys = {
  tripSearch: (filters: Record<string, unknown>) =>
    `${CACHE_PREFIX}:trips:search:${hashObject(filters)}`,

  tripDetail: (slug: string) =>
    `${CACHE_PREFIX}:trips:detail:${slug}`,

  destinationList: () =>
    `${CACHE_PREFIX}:destinations:list`,

  destinationDetail: (slug: string) =>
    `${CACHE_PREFIX}:destinations:detail:${slug}`,

  categoriesActive: () =>
    `${CACHE_PREFIX}:categories:active`,

  organizerProfile: (slug: string) =>
    `${CACHE_PREFIX}:organizers:slug:${slug}`,
} as const

// ─── Invalidation Prefixes ──────────────────────────

export const cacheInvalidation = {
  allTrips: () => `${CACHE_PREFIX}:trips:*`,
  allDestinations: () => `${CACHE_PREFIX}:destinations:*`,
  allCategories: () => `${CACHE_PREFIX}:categories:*`,
  organizerProfile: (slug: string) => `${CACHE_PREFIX}:organizers:slug:${slug}`,
} as const
