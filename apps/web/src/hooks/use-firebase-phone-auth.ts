'use client'

import { useState, useCallback, useRef } from 'react'
import type { ConfirmationResult, RecaptchaVerifier as RecaptchaVerifierType } from 'firebase/auth'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'

/** Dynamically imports Firebase auth SDK — only loaded when actually called. */
async function loadFirebaseAuth() {
  const [{ getFirebaseClientAuth }, firebaseAuth] = await Promise.all([
    import('@/lib/firebase'),
    import('firebase/auth'),
  ])
  const auth = getFirebaseClientAuth()
  if (!auth) throw new Error('Firebase is not configured')
  return { auth, firebaseAuth }
}

interface FirebasePhoneState {
  step: 'phone' | 'otp'
  isPending: boolean
  error: Error | null
}

/**
 * Encapsulates Firebase client-side phone auth flow:
 * 1. sendCode → Firebase sends SMS via reCAPTCHA → moves to OTP step
 * 2. verifyCode → Firebase verifies OTP client-side → gets ID token
 * 3. Sends ID token to backend → backend issues app JWT tokens
 */
export function useFirebasePhoneAuth() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [state, setState] = useState<FirebasePhoneState>({
    step: 'phone',
    isPending: false,
    error: null,
  })
  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifierType | null>(null)

  const sendCode = useCallback(async (phone: string, recaptchaContainerId: string) => {
    setState(s => ({ ...s, isPending: true, error: null }))

    try {
      const { auth, firebaseAuth } = await loadFirebaseAuth()

      // Create reCAPTCHA verifier (invisible)
      if (!recaptchaRef.current) {
        recaptchaRef.current = new firebaseAuth.RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
        })
      }

      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`
      const confirmation = await firebaseAuth.signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current)
      confirmationRef.current = confirmation

      setState({ step: 'otp', isPending: false, error: null })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState(s => ({ ...s, isPending: false, error }))
      throw error
    }
  }, [])

  const verifyCode = useCallback(async (otp: string): Promise<{ isNewUser: boolean }> => {
    if (!confirmationRef.current) {
      throw new Error('No confirmation result. Send code first.')
    }

    setState(s => ({ ...s, isPending: true, error: null }))

    try {
      // Firebase verifies OTP client-side
      const credential = await confirmationRef.current.confirm(otp)
      const idToken = await credential.user.getIdToken()

      // Send ID token to our backend for app JWT
      const { data } = await apiClient.post('/auth/firebase/verify', { idToken })
      const result = data.data

      setAuth(result.user, result.tokens.accessToken)
      setState(s => ({ ...s, isPending: false }))

      return { isNewUser: result.isNewUser }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState(s => ({ ...s, isPending: false, error }))
      throw error
    }
  }, [setAuth])

  const reset = useCallback(() => {
    confirmationRef.current = null
    setState({ step: 'phone', isPending: false, error: null })
  }, [])

  return {
    step: state.step,
    isPending: state.isPending,
    error: state.error,
    sendCode,
    verifyCode,
    reset,
  }
}
