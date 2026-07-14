import { useState, useCallback } from 'react'
import { useUploadSignature } from './use-upload-signature'
import type { UploadFolder } from '@shared/constants'

interface UploadResult {
  secure_url: string
  public_id: string
}

/**
 * Uploads files directly to Cloudinary using signed upload.
 *
 * Flow: get signature from our API → POST file to Cloudinary → return secure_url.
 * Never routes image bytes through Express (per project rules).
 */
export function useCloudinaryUpload() {
  const { mutateAsync: getSignature } = useUploadSignature()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const uploadFile = useCallback(
    async (file: File, folder: UploadFolder = 'trips'): Promise<string> => {
      const sig = await getSignature(folder)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('signature', sig.signature)
      formData.append('timestamp', String(sig.timestamp))
      formData.append('api_key', sig.apiKey)
      formData.append('folder', sig.folder)
      formData.append('transformation', 'c_limit,w_1920,h_1080,q_auto,f_auto')

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: formData },
      )

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Cloudinary upload failed: ${body}`)
      }

      const data: UploadResult = await res.json()
      return data.secure_url
    },
    [getSignature],
  )

  // Wraps uploadFile with isUploading so single-file callers (e.g. verification docs) get a loader too.
  const upload = useCallback(
    async (file: File, folder: UploadFolder = 'trips'): Promise<string> => {
      setIsUploading(true)
      try {
        return await uploadFile(file, folder)
      } finally {
        setIsUploading(false)
      }
    },
    [uploadFile],
  )

  const uploadMany = useCallback(
    async (files: File[], folder: UploadFolder = 'trips'): Promise<string[]> => {
      setIsUploading(true)
      setUploadProgress(0)
      const urls: string[] = []

      try {
        for (let i = 0; i < files.length; i++) {
          const url = await uploadFile(files[i], folder)
          urls.push(url)
          setUploadProgress(Math.round(((i + 1) / files.length) * 100))
        }
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }

      return urls
    },
    [uploadFile],
  )

  return { upload, uploadMany, isUploading, uploadProgress }
}
