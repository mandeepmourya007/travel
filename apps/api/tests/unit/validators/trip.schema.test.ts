import { describe, it, expect } from 'vitest'
import { tripFiltersSchema, createTripSchema } from '@shared/validators/trip.schema'

const validCreateTripInput = {
  title: 'Goa Beach Getaway',
  destinationId: 'clh1234567890abcdefghijkl',
  tripType: 'BEACH',
  description: 'An amazing beach trip to Goa with water sports and parties.',
  startDate: '2026-12-06T00:00:00.000Z',
  endDate: '2026-12-08T00:00:00.000Z',
  pricePerPerson: 4500,
  minGroupSize: 10,
  maxGroupSize: 20,
  photos: ['https://example.com/photo.jpg'],
  pickupPoints: [{ label: 'Pune Station', time: '06:00 AM' }],
  dropPoints: [{ label: 'Pune Station', time: '08:00 PM' }],
}

describe('createTripSchema', () => {
  it('accepts INSTANT bookingMode', () => {
    const result = createTripSchema.safeParse({ ...validCreateTripInput, bookingMode: 'INSTANT' })
    expect(result.success).toBe(true)
  })

  it('rejects REQUEST_BASED bookingMode while the feature is disabled', () => {
    const result = createTripSchema.safeParse({ ...validCreateTripInput, bookingMode: 'REQUEST_BASED' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Request-based booking is currently unavailable')
      expect(result.error.issues[0].path).toEqual(['bookingMode'])
    }
  })
})

describe('tripFiltersSchema', () => {
  describe('sort', () => {
    it('defaults to newest when sort is omitted', () => {
      const result = tripFiltersSchema.parse({})
      expect(result.sort).toBe('newest')
    })

    it('accepts newest', () => {
      const result = tripFiltersSchema.parse({ sort: 'newest' })
      expect(result.sort).toBe('newest')
    })

    it('accepts popularity', () => {
      const result = tripFiltersSchema.parse({ sort: 'popularity' })
      expect(result.sort).toBe('popularity')
    })

    it('accepts price_asc', () => {
      const result = tripFiltersSchema.parse({ sort: 'price_asc' })
      expect(result.sort).toBe('price_asc')
    })

    it('accepts price_desc', () => {
      const result = tripFiltersSchema.parse({ sort: 'price_desc' })
      expect(result.sort).toBe('price_desc')
    })

    it('accepts rating', () => {
      const result = tripFiltersSchema.parse({ sort: 'rating' })
      expect(result.sort).toBe('rating')
    })

    it('accepts date', () => {
      const result = tripFiltersSchema.parse({ sort: 'date' })
      expect(result.sort).toBe('date')
    })

    it('rejects unknown sort value', () => {
      const result = tripFiltersSchema.safeParse({ sort: 'unknown' })
      expect(result.success).toBe(false)
    })

    it('rejects empty string for sort', () => {
      const result = tripFiltersSchema.safeParse({ sort: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('limit', () => {
    it('defaults to 20 when limit is omitted', () => {
      const result = tripFiltersSchema.parse({})
      expect(result.limit).toBe(20)
    })

    it('coerces string limit to number', () => {
      const result = tripFiltersSchema.parse({ limit: '6' })
      expect(result.limit).toBe(6)
    })

    it('accepts limit=6 (the homepage request)', () => {
      const result = tripFiltersSchema.parse({ sort: 'popularity', limit: '6' })
      expect(result.sort).toBe('popularity')
      expect(result.limit).toBe(6)
    })

    it('rejects limit above 50', () => {
      const result = tripFiltersSchema.safeParse({ limit: '51' })
      expect(result.success).toBe(false)
    })

    it('rejects limit of 0', () => {
      const result = tripFiltersSchema.safeParse({ limit: '0' })
      expect(result.success).toBe(false)
    })

    it('caps are enforced independently of sort', () => {
      const result = tripFiltersSchema.safeParse({ sort: 'newest', limit: '100' })
      expect(result.success).toBe(false)
    })
  })

  describe('page', () => {
    it('defaults to 1 when page is omitted', () => {
      const result = tripFiltersSchema.parse({})
      expect(result.page).toBe(1)
    })

    it('coerces string page to number', () => {
      const result = tripFiltersSchema.parse({ page: '3' })
      expect(result.page).toBe(3)
    })

    it('rejects page less than 1', () => {
      const result = tripFiltersSchema.safeParse({ page: '0' })
      expect(result.success).toBe(false)
    })
  })

  describe('optional filters', () => {
    it('passes with no filters (all defaults)', () => {
      const result = tripFiltersSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('passes with all filters set', () => {
      const result = tripFiltersSchema.safeParse({
        sort: 'popularity',
        limit: '10',
        page: '2',
        q: 'goa',
        tripType: 'ADVENTURE',
        bookingMode: 'INSTANT',
        minPrice: '1000',
        maxPrice: '5000',
        startDate: '2026-08-01',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid bookingMode', () => {
      const result = tripFiltersSchema.safeParse({ bookingMode: 'CASH' })
      expect(result.success).toBe(false)
    })

    it('accepts INSTANT and REQUEST_BASED bookingMode', () => {
      expect(tripFiltersSchema.safeParse({ bookingMode: 'INSTANT' }).success).toBe(true)
      expect(tripFiltersSchema.safeParse({ bookingMode: 'REQUEST_BASED' }).success).toBe(true)
    })

    it('rejects q that is empty string', () => {
      const result = tripFiltersSchema.safeParse({ q: '' })
      expect(result.success).toBe(false)
    })

    it('rejects q longer than 200 chars', () => {
      const result = tripFiltersSchema.safeParse({ q: 'a'.repeat(201) })
      expect(result.success).toBe(false)
    })
  })
})
