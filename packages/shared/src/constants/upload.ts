export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const REQUIRED_DOC_COUNT = 3

export const ALLOWED_UPLOAD_FOLDERS = ['trips', 'itinerary-docs', 'vehicles', 'verification-docs'] as const
export type UploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number]

export const DOC_TYPES = ['aadhaarFront', 'aadhaarBack', 'panCard'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_LABELS: Record<DocType, string> = {
  aadhaarFront: 'Aadhaar (Front)',
  aadhaarBack: 'Aadhaar (Back)',
  panCard: 'PAN Card',
} as const
