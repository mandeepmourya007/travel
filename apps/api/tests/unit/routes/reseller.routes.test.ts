/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { createResellerRoutes } from '../../../src/routes/reseller.routes'
import { generalRateLimit } from '../../../src/middleware/rate-limit.middleware'

/**
 * Route-wiring check (light, no HTTP): confirms the four money/abuse-sensitive
 * reseller endpoints (main-link generation, sublink generation, public resolve,
 * attribution write — see docs/codebase/Auth & Security.md) have `generalRateLimit`
 * in their middleware stack, without spinning up a full Supertest server.
 */
describe('createResellerRoutes — rate-limit wiring', () => {
  const mockController = {
    createMainLink: (_req: unknown, _res: unknown) => undefined,
    listMainLinks: (_req: unknown, _res: unknown) => undefined,
    getMyMainLinks: (_req: unknown, _res: unknown) => undefined,
    getOrganizerLeads: (_req: unknown, _res: unknown) => undefined,
    getMainLinkBookings: (_req: unknown, _res: unknown) => undefined,
    createSublink: (_req: unknown, _res: unknown) => undefined,
    listSublinks: (_req: unknown, _res: unknown) => undefined,
    getMyLeads: (_req: unknown, _res: unknown) => undefined,
    resolveSublink: (_req: unknown, _res: unknown) => undefined,
    getSublinkBookings: (_req: unknown, _res: unknown) => undefined,
    patchSublink: (_req: unknown, _res: unknown) => undefined,
    recordAttribution: (_req: unknown, _res: unknown) => undefined,
    searchResellers: (_req: unknown, _res: unknown) => undefined,
    searchOrganizers: (_req: unknown, _res: unknown) => undefined,
    getAdminLeads: (_req: unknown, _res: unknown) => undefined,
  } as any
  const authMiddleware = (_req: unknown, _res: unknown, next: () => void) => next()
  const requireRole = (..._roles: string[]) => (_req: unknown, _res: unknown, next: () => void) => next()

  const router = createResellerRoutes(mockController, authMiddleware, requireRole as any)

  function layersFor(path: string, method: string) {
    return router.stack.filter(
      (layer: any) => layer.route?.path === path && layer.route?.methods?.[method.toLowerCase()],
    )
  }

  function middlewareHandlesFor(path: string, method: string): unknown[] {
    const [layer] = layersFor(path, method)
    return (layer?.route?.stack ?? []).map((s: any) => s.handle)
  }

  it('rate-limits POST /main-links (organizer main-link generation)', () => {
    expect(middlewareHandlesFor('/main-links', 'post')).toContain(generalRateLimit)
  })

  it('rate-limits POST /sublinks (reseller sublink generation)', () => {
    expect(middlewareHandlesFor('/sublinks', 'post')).toContain(generalRateLimit)
  })

  it('rate-limits GET /sublinks/resolve/:token (public resolve — no auth)', () => {
    expect(middlewareHandlesFor('/sublinks/resolve/:token', 'get')).toContain(generalRateLimit)
  })

  it('rate-limits POST /attribution (authed attribution write)', () => {
    expect(middlewareHandlesFor('/attribution', 'post')).toContain(generalRateLimit)
  })

  it('does NOT rate-limit plain read routes like GET /main-links (no abuse surface)', () => {
    expect(middlewareHandlesFor('/main-links', 'get')).not.toContain(generalRateLimit)
  })
})
