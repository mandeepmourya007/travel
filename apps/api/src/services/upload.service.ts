import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env'
import { ValidationError } from '../errors/app-error'
import { CLOUDINARY_TRANSFORM } from '../utils/constants'
import { ALLOWED_UPLOAD_FOLDERS } from '@shared/constants'
import type { UploadFolder } from '@shared/constants'

export interface CloudinarySignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

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

    if (!ALLOWED_UPLOAD_FOLDERS.includes(folder)) {
      throw new ValidationError(`Invalid upload folder: ${folder}`)
    }

    const envPrefix = env.NODE_ENV === 'production' ? 'prod' : 'dev'
    const fullFolder = `${envPrefix}/${folder}`

    const timestamp = Math.round(Date.now() / 1000)
    const params = {
      timestamp,
      folder: fullFolder,
      transformation: CLOUDINARY_TRANSFORM,
    }

    const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET)

    return {
      signature,
      timestamp,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder: fullFolder,
    }
  }

  validateCloudinaryUrl(url: string): boolean {
    if (!env.CLOUDINARY_CLOUD_NAME) return false
    return url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
  }
}
