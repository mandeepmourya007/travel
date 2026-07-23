'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/shared/modal'
import { PhoneVerificationFlow } from '@/components/auth/phone-verification-flow'
import { EmailVerificationFlow } from '@/components/auth/email-verification-flow'
import { useUpdateProfile } from '@/hooks/use-profile'
import { profileKeys } from '@/lib/query-keys'
import type { UserProfileResponse } from '@shared/types/user.types'

interface EditProfileModalProps {
  profile: UserProfileResponse
}

type ActiveField = 'email' | 'phone' | null

/**
 * "Edit Profile" trigger + modal for the traveler profile page. Three
 * independent field-edit affordances inside one modal:
 *  - Name: plain text, saved directly via PATCH /auth/profile.
 *  - Email / Phone: clicking Change/Add/Verify swaps that row into the
 *    respective attach+verify OTP flow — the new value is only persisted
 *    once the OTP for the NEW identifier is verified.
 */
export function EditProfileModal({ profile }: EditProfileModalProps) {
  const [open, setOpen] = useState(false)
  const [activeField, setActiveField] = useState<ActiveField>(null)
  const [name, setName] = useState(profile.name)
  const queryClient = useQueryClient()
  const updateProfile = useUpdateProfile()

  const isNameValid = name.trim().length >= 2
  const nameChanged = name.trim() !== profile.name
  const canSaveName = isNameValid && nameChanged && !updateProfile.isPending

  function closeModal() {
    setOpen(false)
    setActiveField(null)
    setName(profile.name)
  }

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!canSaveName) return
    updateProfile.mutate({ name: name.trim() })
  }

  function handleVerifiedSuccess() {
    setActiveField(null)
    queryClient.invalidateQueries({ queryKey: profileKeys.me() })
  }

  return (
    <>
      <button
        type="button"
        data-testid="edit-profile-trigger"
        onClick={() => setOpen(true)}
        className="btn-secondary px-4 py-2 text-sm"
      >
        Edit Profile
      </button>

      <Modal open={open} onClose={closeModal} title="Edit Profile">
        <div className="space-y-6">
          {/* Name */}
          <form onSubmit={handleSaveName} className="space-y-2">
            <label htmlFor="edit-profile-name" className="label">
              Name
            </label>
            <div className="flex gap-2">
              <input
                id="edit-profile-name"
                data-testid="edit-profile-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input flex-1"
                minLength={2}
                maxLength={100}
              />
              <button
                type="submit"
                data-testid="edit-profile-name-save"
                disabled={!canSaveName}
                className="btn-primary px-4 disabled:opacity-50"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
            {name.trim().length > 0 && !isNameValid && (
              <p className="text-xs text-error-500">Name must be at least 2 characters</p>
            )}
            {updateProfile.error && (
              <p data-testid="edit-profile-name-error" className="text-sm text-error-500">
                {updateProfile.error.message}
              </p>
            )}
          </form>

          {/* Email */}
          <div className="space-y-3 border-t border-neutral-100 pt-5">
            <p className="label">Email</p>
            {activeField === 'email' ? (
              <EmailVerificationFlow
                onSuccess={handleVerifiedSuccess}
                onCancel={() => setActiveField(null)}
                // "Verify" (existing, unverified) auto-sends to the current
                // address instead of prompting for a new one; "Change"/"Add" don't.
                initialEmail={profile.email && !profile.emailVerified ? profile.email : undefined}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{profile.email ?? '—'}</p>
                  {profile.email && !profile.emailVerified && (
                    <p className="text-xs text-error-500">Not verified</p>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="edit-profile-email-trigger"
                  onClick={() => setActiveField('email')}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  {profile.email && profile.emailVerified ? 'Change' : profile.email ? 'Verify' : 'Add'}
                </button>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-3 border-t border-neutral-100 pt-5">
            <p className="label">Phone</p>
            {activeField === 'phone' ? (
              <PhoneVerificationFlow
                onSuccess={handleVerifiedSuccess}
                onCancel={() => setActiveField(null)}
                // "Verify" (existing, unverified) auto-sends to the current
                // number instead of prompting for a new one; "Change"/"Add" don't.
                // profile.phone is stored with a +91 prefix; PhoneVerificationFlow
                // expects a bare 10-digit number.
                initialPhone={
                  profile.phone && !profile.phoneVerified
                    ? profile.phone.replace(/\D/g, '').slice(-10)
                    : undefined
                }
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{profile.phone ?? '—'}</p>
                  {profile.phone && !profile.phoneVerified && (
                    <p className="text-xs text-error-500">Not verified</p>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="edit-profile-phone-trigger"
                  onClick={() => setActiveField('phone')}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  {profile.phone && profile.phoneVerified ? 'Change' : profile.phone ? 'Verify' : 'Add'}
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
