/**
 * Server-side API fetch utility for Next.js Server Components & Route Handlers.
 *
 * Uses `API_URL_INTERNAL` (Docker inter-container URL) when available,
 * falls back to `NEXT_PUBLIC_API_URL` (works for local `next dev`).
 *
 * Uses native `fetch()` (not axios) to integrate with Next.js ISR cache.
 */

import { cache } from 'react'

const SSR_SLOW_THRESHOLD_MS = 1000

function getApiBaseUrl(): string {
  return process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1'
}

export interface FetchApiOptions {
  revalidate?: number | false
  tags?: string[]
  /** Abort the fetch after this many milliseconds. Use in generateStaticParams to fail fast when the API is unreachable instead of hanging until the OS TCP timeout. */
  timeoutMs?: number
}

async function timedFetch(path: string, options: FetchApiOptions): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`
  const start = performance.now()

  const nextOptions: NextFetchRequestConfig = {}
  if (options.revalidate !== undefined) {
    nextOptions.revalidate = options.revalidate
  }
  if (options.tags) {
    nextOptions.tags = options.tags
  }

  const requestId = crypto.randomUUID()
  const res = await fetch(url, {
    next: nextOptions,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    ...(options.timeoutMs !== undefined && { signal: AbortSignal.timeout(options.timeoutMs) }),
  })

  const duration = Math.round(performance.now() - start)
  if (duration > SSR_SLOW_THRESHOLD_MS) {
    // eslint-disable-next-line no-console -- server-side perf instrumentation
    console.warn(`[SSR-FETCH] SLOW ${path} ${res.status} ${duration}ms rid=${requestId}`)
  }

  if (!res.ok) {
    let message = `API error ${res.status}: ${res.statusText}`
    try {
      const body = await res.json() as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch { /* non-JSON response — keep default message */ }
    throw new Error(message)
  }

  return res
}

export async function fetchApi<T>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  const res = await timedFetch(path, options)
  const json = await res.json() as { success: boolean; data: T }
  return json.data
}

/**
 * Popular trips used by `generateStaticParams` on the trip detail and
 * organizer profile pages. Wrapped in `cache()` so a single build-time
 * request serves both routes; each caller maps the slugs it needs.
 */
export const getPopularTripsForStaticParams = cache(
  async (): Promise<{ slug: string; organizer: { slug: string } | null }[]> => {
    const result = await fetchApi<{ data: { slug: string; organizer: { slug: string } | null }[] }>(
      '/trips?limit=50&sort=popularity',
      { revalidate: false, timeoutMs: 10_000 },
    )
    return result.data
  },
)

export async function fetchApiWithPagination<T>(
  path: string,
  options: FetchApiOptions = {},
): Promise<{ data: T; pagination: { page: number; limit: number; total: number; totalPages: number } | null }> {
  const res = await timedFetch(path, options)
  const json = await res.json() as { success: boolean; data: T; pagination?: { page: number; limit: number; total: number; totalPages: number } }
  return { data: json.data, pagination: json.pagination ?? null }
}
