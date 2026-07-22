'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated'
import { apiClient, isAppApiError } from '@/lib/api-client'
import { APP_NAME, getPostAuthRoute } from '@/lib/constants'
import { organizerSignupSchema } from '@shared/validators/auth.schema'
import { useLoadingStore } from '@/store/loading.store'
import { Checkbox } from '@/components/ui/checkbox'

export default function OrganizerSignupPage() {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [form, setForm] = useState({ password: '', name: '', acceptedOrganizerAgreement: false })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // requireOnboarded: false — bounce an authenticated visitor away immediately
  // (matches the original behavior: no completedOnboarding gate on this page).
  useRedirectIfAuthenticated({ requireOnboarded: false })

  useEffect(() => {
    if (!token) return
    apiClient
      .get(`/auth/signup/${token}`)
      .then(({ data: res }) => {
        if (res.success) setEmail(res.data.email)
      })
      .catch(() => {
        setTokenError('This invite link is invalid or has expired.')
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const result = organizerSignupSchema.safeParse(form)
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
      const { data: res } = await apiClient.post(`/auth/signup/${token}`, result.data)
      if (res.success) {
        useLoadingStore.getState().show('Setting up your organizer account...')
        setAuth(res.data.user, res.data.tokens.accessToken)
        router.push(getPostAuthRoute({ isNewUser: true, user: res.data.user }))
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

  if (tokenError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <div className="mt-8 rounded-xl bg-white p-8 shadow-card border border-neutral-100">
            <p className="text-error-500 font-medium">{tokenError}</p>
            <p className="mt-2 text-sm text-neutral-500">Please request a new invite link from the admin.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            {APP_NAME}
          </Link>
          <p className="mt-2 text-neutral-500">Create your organizer account.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-card border border-neutral-100">
          {error && (
            <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Email</label>
              <Input
                type="email"
                value={email}
                readOnly
                className="bg-neutral-50 text-neutral-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
              />
              {getFieldError('name') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('name')}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
              {getFieldError('password') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('password')}</p>
              )}
            </div>

            <div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="acceptedOrganizerAgreement"
                  checked={form.acceptedOrganizerAgreement}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, acceptedOrganizerAgreement: checked === true }))
                  }
                  className="mt-0.5"
                />
                <label htmlFor="acceptedOrganizerAgreement" className="text-sm text-neutral-700">
                  I agree to the{' '}
                  <Link href="/organizer-agreement" className="font-medium text-primary-600 hover:text-primary-700">
                    Organizer Agreement
                  </Link>
                </label>
              </div>
              {getFieldError('acceptedOrganizerAgreement') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('acceptedOrganizerAgreement')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !email || !form.acceptedOrganizerAgreement}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner spinner-sm" /> Creating account...
                </span>
              ) : 'Create organizer account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/login/email" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
