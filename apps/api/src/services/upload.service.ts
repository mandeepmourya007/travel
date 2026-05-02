import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env'
import { ValidationError } from '../errors/app-error'

export interface CloudinarySignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

const ALLOWED_FOLDERS = ['trips', 'itinerary-docs'] as const
type UploadFolder = (typeof ALLOWED_FOLDERS)[number]

export class UploadService {
  constructor() {
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
      })
    }
  }

  generateSignature(folder: UploadFolder): CloudinarySignature {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new ValidationError('Cloudinary is not configured')
    }

    if (!ALLOWED_FOLDERS.includes(folder)) {
      throw new ValidationError(`Invalid upload folder: ${folder}`)
    }

    const timestamp = Math.round(Date.now() / 1000)
    const params = {
      timestamp,
      folder,
      transformation: 'c_limit,w_1920,h_1080,q_auto,f_auto',
    }

    const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET)

    return {
      signature,
      timestamp,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder,
    }
  }

  validateCloudinaryUrl(url: string): boolean {
    if (!env.CLOUDINARY_CLOUD_NAME) return false
    return url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
  }
}
