'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { loginSchema } from '@shared/validators/auth.schema'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'
import { EmailInput } from '@/components/shared/email-input'
import { useLoadingStore } from '@/store/loading.store'

/** Validates returnTo is a safe relative path (no open redirect) */
function getSafeReturnTo(raw: string | null): string | null {
  if (!raw) return null
  // Must start with / and must NOT start with // (protocol-relative URL)
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return null
}

const GOOGLE_PENDING_KEY = 'google_auth_pending'

export default function EmailLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))
  const setAuth = useAuthStore((s) => s.setAuth)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const completedOnboarding = useAuthStore((s) => s.completedOnboarding)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  // Tracks Google redirect-mode flow: set before navigating to Google, cleared on return.
  // Prevents the form from flashing between page load and GIS firing onSuccess.
  const [googleRedirectPending, setGoogleRedirectPending] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!sessionStorage.getItem(GOOGLE_PENDING_KEY)
    }
    return false
  })

  useEffect(() => {
    if (hasHydrated && isAuthenticated && completedOnboarding) {
      router.replace(returnTo ?? getHomeRoute(useAuthStore.getState().user?.role))
    }
  }, [hasHydrated, isAuthenticated, completedOnboarding, router, returnTo])

  const clearGooglePending = () => {
    sessionStorage.removeItem(GOOGLE_PENDING_KEY)
    setGoogleRedirectPending(false)
  }

  // Safety valve: if GIS never calls onSuccess/onError (e.g. popup dismissed on iOS without
  // triggering onError), the spinner would be stuck indefinitely. Clear after 60s.
  useEffect(() => {
    if (!googleRedirectPending) return
    const t = setTimeout(() => {
      sessionStorage.removeItem(GOOGLE_PENDING_KEY)
      setGoogleRedirectPending(false)
    }, 60_000)
    return () => clearTimeout(t)
  }, [googleRedirectPending])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    
    const result = loginSchema.safeParse(form)
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
      const { data: res } = await apiClient.post('/auth/login', result.data)
      if (res.success) {
        useLoadingStore.getState().show('Signing in...')
        setAuth(res.data.user, res.data.tokens.accessToken)
        markOnboardingComplete()
        router.push(returnTo ?? getHomeRoute(res.data.user.role))
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  // Show spinner while:
  // 1. Auth hydration is in progress (avoids form flash for already-authenticated users)
  // 2. Returning from a Google OAuth redirect (avoids form flash before GIS fires onSuccess)
  // 3. Already authenticated and useEffect redirect is about to fire
  if (!hasHydrated || googleRedirectPending || (isAuthenticated && completedOnboarding)) {
    return (
      <div className="flex flex-1 items-center justify-center bg-neutral-50">
        <span className="spinner w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">Welcome back! Sign in to your account.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          {error && (
            <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <EmailInput
              id="email"
              label="Email"
              value={form.email}
              onChange={(val) => setForm((f) => ({ ...f, email: val }))}
              error={fieldErrors.email}
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
                placeholder="Enter your password"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-error-500">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner spinner-sm" /> Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <GoogleAuthSection
            onInitiate={() => {
              sessionStorage.setItem(GOOGLE_PENDING_KEY, '1')
              setGoogleRedirectPending(true)
            }}
            onSuccess={(isNewUser) => {
              clearGooglePending()
              useLoadingStore.getState().show('Signing in...')
              if (!isNewUser) markOnboardingComplete()
              router.push(isNewUser ? '/onboarding' : (returnTo ?? getHomeRoute(useAuthStore.getState().user?.role)))
            }}
            onError={clearGooglePending}
          />

          <p className="mt-6 text-center text-sm text-neutral-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary-600 hover:text-primary-700">
              Sign up
            </Link>
          </p>

          <p className="mt-3 text-center text-sm text-neutral-500">
            Or{' '}
            <Link href="/login/email-otp" className="font-medium text-primary-600 hover:text-primary-700">
              login with email OTP
            </Link>
            {/* TODO: Uncomment when phone OTP is set up
            {' · '}
            <Link href="/login/phone" className="font-medium text-primary-600 hover:text-primary-700">
              login with phone
            </Link>
            */}
          </p>
        </div>
      </div>
    </div>
  )
}
