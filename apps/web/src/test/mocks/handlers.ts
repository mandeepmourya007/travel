import { http, HttpResponse } from 'msw'
import { makeTripDetail } from '../factories/trip.factory'
import { API_BASE_URL as API } from '../test-constants'

export const handlers = [
  // GET /trips/slug/:slug — returns TripDetail
  http.get(`${API}/trips/slug/:slug`, ({ params }) => {
    const slug = params.slug as string
    return HttpResponse.json({
      success: true,
      data: makeTripDetail({ slug }),
    })
  }),

  // GET /trips — returns TripSummary[] (for trip-grid integration)
  http.get(`${API}/trips`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
  }),

  // POST /auth/otp/send — send OTP
  http.post(`${API}/auth/otp/send`, () => {
    return HttpResponse.json({
      success: true,
      data: { message: 'OTP sent', retryAfter: 30 },
    })
  }),

  // POST /auth/otp/verify — verify OTP
  http.post(`${API}/auth/otp/verify`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: { id: 'u1', name: 'User', role: 'TRAVELER' },
        tokens: { accessToken: 'test-jwt', expiresIn: 900 },
        isNewUser: true,
      },
    })
  }),

  // GET /auth/profile — full profile
  http.get(`${API}/auth/profile`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'u1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        role: 'TRAVELER',
        avatarUrl: null,
        isVerified: false,
        phoneVerified: true,
        createdAt: '2025-01-15T00:00:00.000Z',
        organizerProfile: null,
      },
    })
  }),

  // PATCH /auth/profile — update profile
  http.patch(`${API}/auth/profile`, async ({ request }) => {
    const body = (await request.json()) as { name?: string; role?: string }
    return HttpResponse.json({
      success: true,
      data: { id: 'u1', name: body.name ?? 'User', role: body.role ?? 'TRAVELER' },
    })
  }),

  // PATCH /auth/profile/organizer — update organizer profile
  http.patch(`${API}/auth/profile/organizer`, async ({ request }) => {
    const body = (await request.json()) as { businessName?: string; description?: string }
    return HttpResponse.json({
      success: true,
      data: { businessName: body.businessName ?? 'My Business', description: body.description ?? null },
    })
  }),

  // POST /auth/google — Google OAuth
  http.post(`${API}/auth/google`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: { id: 'u1', name: 'Google User', email: 'google@test.com', role: 'TRAVELER' },
        tokens: { accessToken: 'google-jwt', expiresIn: 900 },
        isNewUser: true,
      },
    })
  }),
]
