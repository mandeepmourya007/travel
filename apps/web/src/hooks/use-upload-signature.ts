import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CloudinarySignature } from '@shared/types/upload.types'

/**
 * Requests a signed Cloudinary upload signature for direct browser uploads.
 *
 * Error handling: re-throws so callers can handle (e.g., show toast)
 */
export function useUploadSignature() {
  return useMutation({
    mutationFn: async (folder: 'trips' | 'itinerary-docs' | 'vehicles') => {
      const res = await apiClient.post<{ success: true; data: CloudinarySignature }>(
        '/uploads/signature',
        { folder },
      )
      return res.data.data
    },
  })
}
