/**
 * Server-side API fetch utility for Next.js Server Components & Route Handlers.
 *
 * Uses `API_URL_INTERNAL` (Docker inter-container URL) when available,
 * falls back to `NEXT_PUBLIC_API_URL` (works for local `next dev`).
 *
 * Uses native `fetch()` (not axios) to integrate with Next.js ISR cache.
 */

function getApiBaseUrl(): string {
  return process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
}

export interface FetchApiOptions {
  revalidate?: number | false
  tags?: string[]
}

export async function fetchApi<T>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`

  const nextOptions: NextFetchRequestConfig = {}
  if (options.revalidate !== undefined) {
    nextOptions.revalidate = options.revalidate
  }
  if (options.tags) {
    nextOptions.tags = options.tags
  }

  const res = await fetch(url, {
    next: nextOptions,
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }

  const json = await res.json() as { success: boolean; data: T }
  return json.data
}
