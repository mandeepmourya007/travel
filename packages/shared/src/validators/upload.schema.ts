import { z } from 'zod'

export const uploadSignatureSchema = z.object({
  folder: z.enum(['trips', 'itinerary-docs', 'vehicles']),
})
