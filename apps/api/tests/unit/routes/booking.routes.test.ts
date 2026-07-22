/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { createBookingRoutes } from '../../../src/routes/booking.routes'

/**
 * Route-wiring check (light, no HTTP): confirms POST / (booking creation,
 * which also initiates the payment order) has requirePhoneVerified in its
 * middleware stack — closing the server-side gap flagged by the phone
 * verification security audit (see docs/codebase/Auth & Security.md).
 */
describe('createBookingRoutes — phone verification wiring', () => {
  const mockController = {
    createBooking: (_req: unknown, _res: unknown) => undefined,
    getMyBookings: (_req: unknown, _res: unknown) => undefined,
    getMyBookingSummary: (_req: unknown, _res: unknown) => undefined,
    getPendingRequests: (_req: unknown, _res: unknown) => undefined,
    getMyTripStatus: (_req: unknown, _res: unknown) => undefined,
    cancelBooking: (_req: unknown, _res: unknown) => undefined,
    verifyPayment: (_req: unknown, _res: unknown) => undefined,
    syncPayment: (_req: unknown, _res: unknown) => undefined,
  } as any
  const authMiddleware = (_req: unknown, _res: unknown, next: () => void) => next()
  const requireRole = (..._roles: string[]) => (_req: unknown, _res: unknown, next: () => void) => next()
  const requirePhoneVerified = (_req: unknown, _res: unknown, next: () => void) => next()

  const router = createBookingRoutes(mockController, authMiddleware, requireRole as any, requirePhoneVerified)

  function middlewareHandlesFor(path: string, method: string): unknown[] {
    const [layer] = router.stack.filter(
      (l: any) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()],
    )
    return (layer?.route?.stack ?? []).map((s: any) => s.handle)
  }

  it('gates POST / (create booking + initiate payment) behind requirePhoneVerified', () => {
    expect(middlewareHandlesFor('/', 'post')).toContain(requirePhoneVerified)
  })

  it('does not gate read routes like GET /my', () => {
    expect(middlewareHandlesFor('/my', 'get')).not.toContain(requirePhoneVerified)
  })
})
