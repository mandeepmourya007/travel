import { http, HttpResponse } from 'msw'
import { makeTripDetail } from '../factories/trip.factory'

const API = 'http://localhost:4000/api/v1'

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

  // PATCH /auth/profile — update profile
  http.patch(`${API}/auth/profile`, async ({ request }) => {
    const body = (await request.json()) as { name: string }
    return HttpResponse.json({
      success: true,
      data: { id: 'u1', name: body.name },
    })
  }),
]
