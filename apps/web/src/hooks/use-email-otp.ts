import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { OtpSendResponse } from '@shared/types/auth.types'

/**
 * Sends OTP to email. Handles first send + resend (30s cooldown server-enforced).
 * Error: 429 when cooldown or rate limit exceeded.
 */
export function useSendEmailOtp() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post('/auth/otp/email/send', { email })
      return data.data as OtpSendResponse
    },
  })
}

/**
 * Verifies email OTP and logs user in. Auto-creates user if new email.
 * On success: stores auth in Zustand, returns isNewUser flag.
 */
export function useVerifyEmailOtp() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async (dto: { email: string; otp: string }) => {
      const { data } = await apiClient.post('/auth/otp/email/verify', dto)
      return data.data
    },
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.accessToken)
    },
  })
}
