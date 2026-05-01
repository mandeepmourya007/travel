import { z } from 'zod'

export const createTripSchema = z
  .object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(100).trim(),
    destinationId: z.string().cuid(),
    tripType: z.enum(['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP']),
    bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).default('INSTANT'),
    description: z.string().min(20, 'Description must be at least 20 characters'),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    pricePerPerson: z.number().int().positive().min(100, 'Minimum price is ₹100'),
    minGroupSize: z.number().int().min(2),
    maxGroupSize: z.number().int().max(50),
    cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']).default('FLEXIBLE'),
    inclusions: z.array(z.string()).default([]),
    exclusions: z.array(z.string()).default([]),
    itinerary: z
      .array(
        z.object({
          day: z.number().int().positive(),
          title: z.string().min(1),
          description: z.string(),
          activities: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    photos: z.array(z.string().url()).max(8).default([]),
    pickupLocation: z.string().optional(),
    pickupTime: z.string().optional(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  })
  .refine((data) => data.maxGroupSize >= data.minGroupSize, {
    message: 'Max group size must be >= min group size',
    path: ['maxGroupSize'],
  })

export const tripFiltersSchema = z.object({
  destinationId: z.string().cuid().optional(),
  destination: z.string().optional(),
  tripType: z
    .enum(['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP'])
    .optional(),
  bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  startDate: z.string().optional(),
  sort: z
    .enum(['price_asc', 'price_desc', 'rating', 'date', 'popularity'])
    .default('date'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
