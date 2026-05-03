import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { OtpSendResponse } from '@shared/types/auth.types'

/**
 * Sends OTP to phone. Handles first send + resend (30s cooldown server-enforced).
 * Error: 429 when cooldown or rate limit exceeded.
 */
export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      apiClient.post<OtpSendResponse>('/auth/otp/send', { phone }).then(r => r.data),
  })
}

/**
 * Verifies OTP and logs user in. Auto-creates user if new phone.
 * On success: stores auth in Zustand, returns isNewUser flag.
 */
export function useVerifyOtp() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async (dto: { phone: string; otp: string }) => {
      const { data } = await apiClient.post('/auth/otp/verify', dto)
      return data.data
    },
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.accessToken)
    },
  })
}
