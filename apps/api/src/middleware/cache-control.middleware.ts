import type { RequestHandler } from 'express'

/**
 * Sets Cache-Control header on GET responses for public endpoints.
 * Browsers will serve from local cache for `maxAge` seconds without contacting the server,
 * eliminating expensive 304 round-trips that still run full DB queries on the server.
 *
 * @param maxAge — seconds to cache (default: 60)
 */
export function cacheControl(maxAge = 60): RequestHandler {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`)
    next()
  }
}
