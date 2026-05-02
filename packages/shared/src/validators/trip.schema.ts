import { z } from 'zod'

const itineraryActivitySchema = z.object({
  time: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
})

const itineraryDaySchema = z.object({
  day: z.number().int().positive(),
  date: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string(),
  activities: z.array(itineraryActivitySchema).default([]),
  includes: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
})

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
    itinerary: z.array(itineraryDaySchema).default([]),
    photos: z.array(z.string().url()).max(8).default([]),
    pickupLocation: z.string().optional(),
    pickupTime: z.string().optional(),
    earlyBirdPrice: z.number().int().positive().optional(),
    earlyBirdDeadline: z.string().datetime().optional(),
    itineraryDocUrl: z.string().url().optional(),
    bookingDeadline: z.string().datetime().optional(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  })
  .refine((data) => data.maxGroupSize >= data.minGroupSize, {
    message: 'Max group size must be >= min group size',
    path: ['maxGroupSize'],
  })
  .refine(
    (data) => {
      if (data.earlyBirdPrice !== undefined) {
        return data.earlyBirdPrice < data.pricePerPerson
      }
      return true
    },
    { message: 'Early bird price must be less than regular price', path: ['earlyBirdPrice'] },
  )
  .refine(
    (data) => {
      if (data.earlyBirdPrice !== undefined && !data.earlyBirdDeadline) {
        return false
      }
      return true
    },
    { message: 'Early bird deadline is required when early bird price is set', path: ['earlyBirdDeadline'] },
  )

export const updateTripSchema = z
  .object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(100).trim().optional(),
    destinationId: z.string().cuid().optional(),
    tripType: z
      .enum(['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP'])
      .optional(),
    bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).optional(),
    description: z.string().min(20, 'Description must be at least 20 characters').optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    pricePerPerson: z.number().int().positive().min(100, 'Minimum price is ₹100').optional(),
    earlyBirdPrice: z.number().int().positive().optional(),
    earlyBirdDeadline: z.string().datetime().optional(),
    minGroupSize: z.number().int().min(2).optional(),
    maxGroupSize: z.number().int().max(50).optional(),
    cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']).optional(),
    inclusions: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    itinerary: z.array(itineraryDaySchema).optional(),
    photos: z.array(z.string().url()).max(8).optional(),
    pickupLocation: z.string().optional(),
    pickupTime: z.string().optional(),
    itineraryDocUrl: z.string().url().optional(),
    bookingDeadline: z.string().datetime().optional(),
    acceptingBookings: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate)
      }
      return true
    },
    { message: 'End date must be after start date', path: ['endDate'] },
  )
  .refine(
    (data) => {
      if (data.minGroupSize !== undefined && data.maxGroupSize !== undefined) {
        return data.maxGroupSize >= data.minGroupSize
      }
      return true
    },
    { message: 'Max group size must be >= min group size', path: ['maxGroupSize'] },
  )

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
