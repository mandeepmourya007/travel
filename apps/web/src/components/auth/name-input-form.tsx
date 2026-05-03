'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/hooks/use-profile'
import { isAppApiError } from '@/lib/api-client'

interface NameInputFormProps {
  onComplete: () => void
}

export function NameInputForm({ onComplete }: NameInputFormProps) {
  const [name, setName] = useState('')
  const updateProfile = useUpdateProfile()
  const isValid = name.trim().length >= 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      await updateProfile.mutateAsync({ name: name.trim() })
      onComplete()
    } catch { /* error exposed via updateProfile.error */ }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-neutral-900">
          Welcome! What&apos;s your name?
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          This helps organizers and travelers identify you
        </p>
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-neutral-700">
          Full name
        </label>
        <input
          id="name"
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input w-full"
          placeholder="e.g. Rahul Sharma"
        />
      </div>

      {updateProfile.error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500">
          {isAppApiError(updateProfile.error) ? updateProfile.error.message : 'Something went wrong'}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || updateProfile.isPending}
        className="btn-primary w-full disabled:opacity-50"
      >
        {updateProfile.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner spinner-sm" /> Saving...
          </span>
        ) : 'Continue'}
      </button>
    </form>
  )
}
