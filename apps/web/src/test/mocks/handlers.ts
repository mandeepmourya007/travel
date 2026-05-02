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
]
