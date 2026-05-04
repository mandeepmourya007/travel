import { cert, initializeApp, getApps, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { env } from './env'
import { logger } from '../utils/logger'

let firebaseApp: App | null = null

/**
 * Lazy singleton — returns Firebase Auth instance if all 3 env vars are set,
 * or null if Firebase is not configured.
 */
export function getFirebaseAuth(): Auth | null {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return null
  }

  if (getApps().length === 0) {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
    logger.info('Firebase Admin SDK initialized')
  }

  return getAuth(firebaseApp ?? undefined)
}
