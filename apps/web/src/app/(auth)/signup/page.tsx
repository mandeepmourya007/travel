'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { apiClient, isAppApiError } from '@/lib/api-client'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { signupSchema } from '@shared/validators/auth.schema'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'
import { EmailInput } from '@/components/shared/email-input'
import { useLoadingStore } from '@/store/loading.store'

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace(getHomeRoute(useAuthStore.getState().user?.role))
    }
  }, [hasHydrated, isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const result = signupSchema.safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string
        if (!errs[field]) errs[field] = issue.message
      })
      setFieldErrors(errs)
      return
    }

    setLoading(true)

    try {
      const { data: res } = await apiClient.post('/auth/signup', result.data)
      if (res.success) {
        useLoadingStore.getState().show('Creating account...')
        setAuth(res.data.user, res.data.tokens.accessToken)
        router.push('/onboarding')
      }
    } catch (err: unknown) {
      if (isAppApiError(err) && err.details) {
        const errs: Record<string, string> = {}
        err.details.forEach((d) => { if (!errs[d.field]) errs[d.field] = d.message })
        setFieldErrors(errs)
      } else {
        setError(err instanceof Error ? err.message : 'Signup failed. Please try again.')
      }
      setLoading(false)
    }
  }

  const getFieldError = (field: string) => fieldErrors[field]

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">Create your account to start exploring trips.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          {error && (
            <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <EmailInput
              id="email"
              label="Email"
              value={form.email}
              onChange={(val) => setForm((f) => ({ ...f, email: val }))}
              error={getFieldError('email')}
            />

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="input"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
              {getFieldError('password') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('password')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner spinner-sm" /> Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <GoogleAuthSection
            onSuccess={(isNewUser) => {
              useLoadingStore.getState().show('Signing in...')
              if (!isNewUser) markOnboardingComplete()
              router.push(isNewUser ? '/onboarding' : getHomeRoute(useAuthStore.getState().user?.role))
            }}
          />

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/login/phone" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
