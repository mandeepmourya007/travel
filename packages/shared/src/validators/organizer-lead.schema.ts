import { z } from 'zod'
import { ORGANIZER_LEAD_STATUSES } from '../constants/organizer-lead'

// E.164-ish: optional leading '+', 8–15 digits, first digit non-zero.
const phoneRegex = /^\+?[1-9]\d{7,14}$/

export const createOrganizerLeadSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Invalid phone number'),
  businessName: z.string().trim().max(100).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export const updateOrganizerLeadStatusSchema = z.object({
  status: z.enum(ORGANIZER_LEAD_STATUSES),
  adminNotes: z.string().trim().max(1000).optional(),
})

export const organizerLeadFiltersSchema = z.object({
  status: z.enum(ORGANIZER_LEAD_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
