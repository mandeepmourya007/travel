import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | undefined
let auth: Auth | undefined

/**
 * Lazy singleton — only initializes if Firebase config env vars are present.
 * Returns null when Firebase is not configured (falls back to backend OTP).
 */
export function getFirebaseClientAuth(): Auth | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return null
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig)
  }

  if (!auth) {
    auth = getAuth(app)
  }

  return auth
}
