'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/hooks/use-profile'
import { VerifyPhoneCta } from '@/components/profile/verify-phone-cta'
import type { UserProfileResponse } from '@shared/types/user.types'

interface EditUserProfileFormProps {
  profile: UserProfileResponse
}

export function EditUserProfileForm({ profile }: EditUserProfileFormProps) {
  const [name, setName] = useState(profile.name)
  const mutation = useUpdateProfile()

  const isNameValid = name.trim().length >= 2
  const hasChanges = name !== profile.name
  const canSubmit = isNameValid && hasChanges && !mutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    mutation.mutate({ name: name.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="card-static space-y-4 p-6">
      <h3 className="text-base font-semibold text-neutral-900">Edit Profile</h3>

      <div>
        <label htmlFor="profile-name" className="label">
          Name
        </label>
        <input
          id="profile-name"
          data-testid="profile-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          minLength={2}
          maxLength={100}
        />
        {name.trim().length > 0 && !isNameValid && (
          <p className="mt-1 text-xs text-error-500">Name must be at least 2 characters</p>
        )}
      </div>

      {/* Read-only fields */}
      <div className="grid grid-cols-2 gap-4 rounded-lg bg-neutral-50 p-4">
        <div>
          <p className="text-xs text-neutral-500">Email</p>
          <p className="text-sm font-medium text-neutral-800">{profile.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Phone</p>
          <p className="text-sm font-medium text-neutral-800">{profile.phone ?? '—'}</p>
          {!profile.phoneVerified && (
            <div className="mt-2">
              <VerifyPhoneCta />
            </div>
          )}
        </div>
      </div>

      {mutation.error && (
        <p data-testid="profile-save-error" className="text-sm text-error-500">
          {mutation.error.message}
        </p>
      )}

      <button
        type="submit"
        data-testid="profile-save-btn"
        disabled={!canSubmit}
        className="btn-primary"
      >
        {mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  )
}
