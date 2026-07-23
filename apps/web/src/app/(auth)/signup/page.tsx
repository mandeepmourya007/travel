'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated'
import { apiClient, isAppApiError } from '@/lib/api-client'
import { APP_NAME, getPostAuthRoute } from '@/lib/constants'
import { signupSchema } from '@shared/validators/auth.schema'
import { GoogleAuthSection } from '@/components/auth/google-auth-section'
import { EmailInput } from '@/components/shared/email-input'
import { useLoadingStore } from '@/store/loading.store'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const markOnboardingComplete = useAuthStore((s) => s.markOnboardingComplete)
  const [form, setForm] = useState({ email: '', password: '', acceptedTerms: false })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useRedirectIfAuthenticated()

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

            <div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="acceptedTerms"
                  checked={form.acceptedTerms}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, acceptedTerms: checked === true }))
                  }
                  className="mt-0.5"
                />
                <label htmlFor="acceptedTerms" className="text-sm text-neutral-700">
                  I agree to the{' '}
                  <Link href="/terms" className="font-medium text-primary-600 hover:text-primary-700">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="font-medium text-primary-600 hover:text-primary-700">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {getFieldError('acceptedTerms') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('acceptedTerms')}</p>
              )}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Wrapper span, not the <button> itself, is the actual hover/focus trigger —
                      a native disabled button doesn't reliably fire pointer/hover events in all
                      browsers. Only needs to be a tab stop while the button underneath can't be
                      one itself (i.e. while disabled) — otherwise it'd add a second, redundant
                      tab stop next to the button's own native focusability. */}
                  <span tabIndex={!form.acceptedTerms ? 0 : undefined} className="block w-full">
                    <button
                      type="submit"
                      disabled={loading || !form.acceptedTerms}
                      className={cn(
                        'btn-primary w-full disabled:opacity-50',
                        !form.acceptedTerms && 'pointer-events-none',
                      )}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="spinner spinner-sm" /> Creating account...
                        </span>
                      ) : 'Create account'}
                    </button>
                  </span>
                </TooltipTrigger>
                {!form.acceptedTerms && (
                  <TooltipContent>
                    Accept the Terms of Service and Privacy Policy to continue
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </form>

          <GoogleAuthSection
            disabled={!form.acceptedTerms}
            disabledHint="Accept the Terms of Service and Privacy Policy above to continue with Google"
            onSuccess={(isNewUser) => {
              useLoadingStore.getState().show('Signing in...')
              if (!isNewUser) markOnboardingComplete()
              router.push(getPostAuthRoute({ isNewUser, user: useAuthStore.getState().user }))
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
