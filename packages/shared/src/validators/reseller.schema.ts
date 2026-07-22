import { z } from 'zod'
import { idSchema, paginationSchema } from './common.schema'
import { RESELLER_LEAD_SORTS, RESELLER_MAX_MARKUP_AMOUNT } from '../constants/reseller'

// ─── Main links (organizer) ─────────────────────────

export const createMainLinkSchema = z.object({
  tripId: idSchema,
  resellerEmail: z.string().email(),
})

export const mainLinkFiltersSchema = paginationSchema.extend({
  tripId: idSchema.optional(),
  resellerId: idSchema.optional(),
})

/** GET /reseller/main-links/mine — reseller's own filters (resellerId is always the caller, never a query param). */
export const myMainLinksFiltersSchema = paginationSchema.extend({
  tripId: idSchema.optional(),
})

// ─── Sublinks (reseller) ─────────────────────────────

export const createSublinkSchema = z.object({
  mainLinkToken: z.string().min(1),
  markupAmount: z.number().int().min(0).max(RESELLER_MAX_MARKUP_AMOUNT),
  label: z.string().max(200).optional(),
})

export const patchSublinkSchema = z.object({
  markupAmount: z.number().int().min(0).max(RESELLER_MAX_MARKUP_AMOUNT).optional(),
  label: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (d) => d.markupAmount !== undefined || d.label !== undefined || d.isActive !== undefined,
  { message: 'At least one field must be provided' },
)

export const sublinkFiltersSchema = paginationSchema.extend({
  tripId: idSchema.optional(),
  mainLinkId: idSchema.optional(),
})

// ─── Leads (organizer / reseller / admin) ────────────

export const leadsFiltersSchema = paginationSchema.extend({
  tripId: idSchema.optional(),
  resellerId: idSchema.optional(),
  organizerId: idSchema.optional(),
  mainLinkId: idSchema.optional(),
  sort: z.enum(RESELLER_LEAD_SORTS).default('newest'),
})

// ─── Public resolve + attribution ────────────────────

export const sublinkTokenParamSchema = z.object({
  token: z.string().min(1),
})

export const recordAttributionSchema = z.object({
  sublinkToken: z.string().min(1),
})

// ─── Combobox search (resellers / organizers) ────────

export const resellerSearchQuerySchema = paginationSchema.extend({
  q: z.string().max(100).optional(),
})

export const organizerSearchQuerySchema = paginationSchema.extend({
  q: z.string().max(100).optional(),
})
