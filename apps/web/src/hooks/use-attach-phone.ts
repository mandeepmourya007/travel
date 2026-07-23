import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import { profileKeys } from '@/lib/query-keys'
import type { OtpSendResponse, AttachPhoneResponse } from '@shared/types/auth.types'

/**
 * Sends a WhatsApp OTP to attach a phone number to the CURRENT authenticated
 * user (distinct from the public `/auth/otp/send` login flow in `use-otp.ts`).
 * Rejects with a 409 ConflictError (subCode PHONE_TAKEN) if the phone belongs
 * to another account. No store writes — this never touches the session.
 */
export function useSendAttachPhoneOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      apiClient.post<{ data: OtpSendResponse }>('/auth/otp/attach/send', { phone }).then((r) => r.data.data),
  })
}

/**
 * Verifies the attach OTP. On success, the current session/access-token is
 * completely unaffected — the backend never issues tokens for this endpoint.
 * We therefore call `updateUser` (shallow merge), never `setAuth` (which
 * would look like a full session replace). Also invalidates the profile
 * query so `/profile` reflects the change immediately.
 */
export function useVerifyAttachPhoneOtp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: { phone: string; otp: string }) =>
      apiClient
        .post<{ data: AttachPhoneResponse }>('/auth/otp/attach/verify', dto)
        .then((r) => r.data.data),
    onSuccess: (data) => {
      useAuthStore.getState().updateUser({ phone: data.phone, phoneVerified: data.phoneVerified })
      queryClient.invalidateQueries({ queryKey: profileKeys.me() })
    },
  })
}
