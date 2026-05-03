'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'
import { APP_NAME, getHomeRoute } from '@/lib/constants'
import { loginSchema } from '@shared/validators/auth.schema'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'

export default function EmailLoginPage() {
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
        setAuth(res.data.user, res.data.tokens.accessToken)
        markOnboardingComplete()
        router.push(getHomeRoute(res.data.user.role))
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
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
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input"
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-error-500">{fieldErrors.email}</p>
              )}
            </div>

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
            onSuccess={(isNewUser) => {
              if (!isNewUser) markOnboardingComplete()
              router.push(isNewUser ? '/onboarding' : getHomeRoute(useAuthStore.getState().user?.role))
            }}
          />

          <p className="mt-6 text-center text-sm text-neutral-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary-600 hover:text-primary-700">
              Sign up
            </Link>
          </p>

          <p className="mt-3 text-center text-sm text-neutral-500">
            Or{' '}
            <Link href="/login/phone" className="font-medium text-primary-600 hover:text-primary-700">
              login with phone
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
