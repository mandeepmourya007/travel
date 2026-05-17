import { z } from 'zod'
import { ALLOWED_UPLOAD_FOLDERS } from '../constants/upload'

export const uploadSignatureSchema = z.object({
  folder: z.enum(ALLOWED_UPLOAD_FOLDERS),
})
