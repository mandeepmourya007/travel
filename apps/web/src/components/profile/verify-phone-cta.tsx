'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/shared/modal'
import { PhoneVerificationFlow } from '@/components/auth/phone-verification-flow'
import { profileKeys } from '@/lib/query-keys'

/**
 * Defense-in-depth "Verify phone" CTA rendered next to the read-only phone
 * field on the profile page — only shown when the profile isn't verified yet.
 * The mandatory AuthGuard redirect is the primary enforcement; this is the
 * always-available fallback path.
 */
export function VerifyPhoneCta() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const closeModal = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        data-testid="verify-phone-cta"
        onClick={() => setOpen(true)}
        className="btn-secondary px-3 py-1.5 text-sm"
      >
        Verify phone
      </button>

      <Modal open={open} onClose={closeModal} title="Verify your WhatsApp number">
        <PhoneVerificationFlow
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() })
            closeModal()
          }}
          onCancel={closeModal}
        />
      </Modal>
    </>
  )
}
