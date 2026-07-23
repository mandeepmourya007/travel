import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import { profileKeys } from '@/lib/query-keys'
import type { OtpSendResponse, AttachEmailResponse } from '@shared/types/auth.types'

/**
 * Sends an OTP to attach an email address to the CURRENT authenticated user
 * (distinct from the public `/auth/otp/email/send` login flow in `use-email-otp.ts`).
 * Rejects with a 409 ConflictError (subCode EMAIL_TAKEN) if the email belongs
 * to another account. No store writes — this never touches the session.
 */
export function useSendAttachEmailOtp() {
  return useMutation({
    mutationFn: (email: string) =>
      apiClient.post<{ data: OtpSendResponse }>('/auth/otp/attach-email/send', { email }).then((r) => r.data.data),
  })
}

/**
 * Verifies the attach OTP. On success, the current session/access-token is
 * completely unaffected — the backend never issues tokens for this endpoint.
 * We therefore call `updateUser` (shallow merge), never `setAuth` (which
 * would look like a full session replace). Also invalidates the profile
 * query so `/profile` reflects the change immediately.
 */
export function useVerifyAttachEmailOtp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: { email: string; otp: string }) =>
      apiClient
        .post<{ data: AttachEmailResponse }>('/auth/otp/attach-email/verify', dto)
        .then((r) => r.data.data),
    onSuccess: (data) => {
      useAuthStore.getState().updateUser({ email: data.email, emailVerified: data.emailVerified })
      queryClient.invalidateQueries({ queryKey: profileKeys.me() })
    },
  })
}
