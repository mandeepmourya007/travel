/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { createBookingRoutes } from '../../../src/routes/booking.routes'

/**
 * Route-wiring check (light, no HTTP). The old mandatory account-level phone
 * verification gate (requirePhoneVerified) has been retired — booking creation
 * no longer requires it. Contact verification is now booking-scoped and
 * collected post-payment via the /:id/contact/* routes (see BookingService).
 */
describe('createBookingRoutes — wiring', () => {
  const mockController = {
    createBooking: (_req: unknown, _res: unknown) => undefined,
    getMyBookings: (_req: unknown, _res: unknown) => undefined,
    getMyBookingSummary: (_req: unknown, _res: unknown) => undefined,
    getPendingRequests: (_req: unknown, _res: unknown) => undefined,
    getMyTripStatus: (_req: unknown, _res: unknown) => undefined,
    cancelBooking: (_req: unknown, _res: unknown) => undefined,
    verifyPayment: (_req: unknown, _res: unknown) => undefined,
    syncPayment: (_req: unknown, _res: unknown) => undefined,
    sendBookingContactOtp: (_req: unknown, _res: unknown) => undefined,
    verifyBookingContactOtp: (_req: unknown, _res: unknown) => undefined,
    useAccountPhoneForBooking: (_req: unknown, _res: unknown) => undefined,
  } as any
  const authMiddleware = (_req: unknown, _res: unknown, next: () => void) => next()
  const requireRole = (..._roles: string[]) => (_req: unknown, _res: unknown, next: () => void) => next()

  const router = createBookingRoutes(mockController, authMiddleware, requireRole as any)

  function routeExists(path: string, method: string): boolean {
    return router.stack.some(
      (l: any) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()],
    )
  }

  it('registers POST / (create booking + initiate payment)', () => {
    expect(routeExists('/', 'post')).toBe(true)
  })

  it('registers the booking-contact routes', () => {
    expect(routeExists('/:id/contact/send-otp', 'post')).toBe(true)
    expect(routeExists('/:id/contact/verify-otp', 'post')).toBe(true)
    expect(routeExists('/:id/contact/use-account-phone', 'post')).toBe(true)
  })

  it('registers read routes like GET /my', () => {
    expect(routeExists('/my', 'get')).toBe(true)
  })
})
