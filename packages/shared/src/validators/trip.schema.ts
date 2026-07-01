import { z } from 'zod'
import { idSchema } from './common.schema'

/** Accepts a string (newline-separated) or string[] and normalizes to string[] */
const stringOrArray = z.preprocess(
  (val) => val == null ? val : typeof val === 'string' ? val.split('\n').map((s: string) => s.trim()).filter(Boolean) : val,
  z.array(z.string()),
)

/** Accepts datetime-local ('2026-06-01T14:56') and full ISO ('2026-06-01T14:56:00.000Z'), rejects loose strings */
const ISO_OR_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/
const datetimeString = z.string()
  .refine((val) => ISO_OR_LOCAL.test(val) && !isNaN(Date.parse(val)), { message: 'Invalid datetime' })
  .transform((val) => new Date(val).toISOString())

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

const transferPointSchema = z.object({
  label: z.string().min(2, 'Label must be at least 2 characters').max(100).trim(),
  address: z.string().max(200).optional(),
  time: z.string().max(20).optional(),
  extraCharge: z.number().int().min(0).default(0),
})

export const createTripSchema = z
  .object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(100).trim(),
    destinationId: z.string().min(1, 'Destination is required'),
    tripType: z.string().min(1, 'Trip type is required'),
    bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).default('INSTANT'),
    description: z.string().min(20, 'Description must be at least 20 characters'),
    startDate: datetimeString,
    endDate: datetimeString,
    pricePerPerson: z.number().int().positive().min(100, 'Minimum price is ₹100'),
    minGroupSize: z.number().int().min(2),
    maxGroupSize: z.number().int().max(50),
    cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']).default('FLEXIBLE'),
    inclusions: stringOrArray.default([]),
    exclusions: stringOrArray.default([]),
    itinerary: z.array(itineraryDaySchema).default([]),
    photos: z.array(z.string().url()).min(1, 'At least one photo is required').max(8),
    pickupPoints: z.array(transferPointSchema).min(1, 'At least one pickup point is required').max(10, 'Maximum 10 pickup points'),
    dropPoints: z.array(transferPointSchema).min(1, 'At least one drop point is required').max(10, 'Maximum 10 drop points'),
    earlyBirdPrice: z.number().int().positive().optional(),
    earlyBirdDeadline: datetimeString.optional(),
    itineraryDocUrl: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
    bookingDeadline: datetimeString.optional(),
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
    destinationId: idSchema.optional(),
    tripType: z.string().min(1).optional(),
    bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).optional(),
    description: z.string().min(20, 'Description must be at least 20 characters').optional(),
    startDate: datetimeString.optional(),
    endDate: datetimeString.optional(),
    pricePerPerson: z.number().int().positive().min(100, 'Minimum price is ₹100').optional(),
    earlyBirdPrice: z.number().int().positive().optional(),
    earlyBirdDeadline: datetimeString.optional(),
    minGroupSize: z.number().int().min(2).optional(),
    maxGroupSize: z.number().int().max(50).optional(),
    cancellationPolicy: z.enum(['FLEXIBLE', 'MODERATE', 'STRICT']).optional(),
    inclusions: stringOrArray.optional(),
    exclusions: stringOrArray.optional(),
    itinerary: z.array(itineraryDaySchema).optional(),
    photos: z.array(z.string().url()).max(8).optional(),
    pickupPoints: z.array(transferPointSchema).min(1).max(10).optional(),
    dropPoints: z.array(transferPointSchema).min(1).max(10).optional(),
    itineraryDocUrl: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
    bookingDeadline: datetimeString.optional(),
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
  destinationId: idSchema.optional(),
  destination: z.string().optional(),
  /** Free-text search — splits into tokens, OR-matches title, description, destination name, trip type */
  q: z.string().trim().min(1).max(200).optional(),
  tripType: z.string().optional(),
  bookingMode: z.enum(['INSTANT', 'REQUEST_BASED']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  startDate: z.string().optional(),
  sort: z
    .enum(['price_asc', 'price_desc', 'rating', 'date', 'popularity', 'newest', 'trending'])
    .default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
