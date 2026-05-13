import { z } from 'zod'

export const createTripCategorySchema = z.object({
  value: z
    .string()
    .min(2, 'Value must be at least 2 characters')
    .max(30)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Must be UPPER_SNAKE_CASE')
    .trim(),
  label: z.string().min(2, 'Label must be at least 2 characters').max(50).trim(),
  icon: z.string().max(30).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateTripCategorySchema = z.object({
  label: z.string().min(2).max(50).trim().optional(),
  icon: z.string().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const createTripTypeRequestSchema = z.object({
  suggestedName: z.string().min(2, 'Name must be at least 2 characters').max(50).trim(),
  reason: z.string().min(10, 'Please provide at least 10 characters').max(300).trim(),
})

export const reviewTripTypeRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().max(300).trim().optional(),
})

export const tripTypeRequestFiltersSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
