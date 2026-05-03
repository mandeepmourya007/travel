'use client'

import { useState } from 'react'
import { useUpdateProfile } from '@/hooks/use-profile'
import { useAuthStore } from '@/store/auth.store'
import { DEFAULT_USER_NAME } from '@shared/constants/roles'

/** Onboarding form for setting user name and role after signup/Google/OTP. */
interface OnboardingFormProps {
  onComplete: () => void
}

export function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const user = useAuthStore((s) => s.user)
  const { mutate, isPending, error } = useUpdateProfile()

  const defaultName = user?.name && user.name !== DEFAULT_USER_NAME ? user.name : ''
  const [name, setName] = useState(defaultName)
  const [role, setRole] = useState<'TRAVELER' | 'ORGANIZER'>('TRAVELER')

  const isValid = name.trim().length >= 2

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    mutate(
      { name: name.trim(), role },
      { onSuccess: () => onComplete() },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="onboarding-form">
      <div>
        <label htmlFor="onboarding-name" className="block text-sm font-medium text-neutral-700">
          Your Name
        </label>
        <input
          id="onboarding-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="input mt-1"
          autoFocus
          disabled={isPending}
          data-testid="onboarding-name-input"
        />
        {name.length > 0 && name.trim().length < 2 && (
          <p className="mt-1 text-sm text-error-500">Name must be at least 2 characters</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          I want to
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole('TRAVELER')}
            className={`rounded-lg border-2 p-4 text-center transition-all ${
              role === 'TRAVELER'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
            disabled={isPending}
            data-testid="role-traveler"
          >
            <span className="block text-lg font-semibold">Travel</span>
            <span className="text-sm text-neutral-500">Find and join trips</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('ORGANIZER')}
            className={`rounded-lg border-2 p-4 text-center transition-all ${
              role === 'ORGANIZER'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
            disabled={isPending}
            data-testid="role-organizer"
          >
            <span className="block text-lg font-semibold">Organize</span>
            <span className="text-sm text-neutral-500">Create and manage trips</span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isValid || isPending}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="onboarding-submit"
      >
        {isPending ? 'Saving...' : 'Continue'}
      </button>

      {error && (
        <p className="text-sm text-error-500 text-center" data-testid="onboarding-error">
          {(error as Error).message || 'Something went wrong'}
        </p>
      )}
    </form>
  )
}
