'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'TRAVELER' as 'TRAVELER' | 'ORGANIZER',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors([])
    setLoading(true)

    try {
      const payload = { ...form }
      if (!payload.phone) delete (payload as Record<string, unknown>).phone

      const { data: res } = await apiClient.post('/auth/signup', payload)
      if (res.success) {
        localStorage.setItem('accessToken', res.data.tokens.accessToken)
        setAuth(res.data.user, res.data.tokens.accessToken)
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string; details?: { field: string; message: string }[] } }
      if (apiErr?.error?.details) {
        setFieldErrors(apiErr.error.details)
      } else {
        setError(apiErr?.error?.message || 'Signup failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getFieldError = (field: string) =>
    fieldErrors.find((e) => e.field === field)?.message

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-extrabold text-primary-600">
            TravelApp
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
            {/* Role toggle */}
            <div className="flex rounded-lg bg-neutral-100 p-1">
              {(['TRAVELER', 'ORGANIZER'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role }))}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    form.role === role
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {role === 'TRAVELER' ? 'Traveler' : 'Organizer'}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
                placeholder="John Doe"
              />
              {getFieldError('name') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('name')}</p>
              )}
            </div>

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
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
                placeholder="you@example.com"
              />
              {getFieldError('email') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('email')}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Phone <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
                placeholder="9876543210"
              />
              {getFieldError('phone') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('phone')}</p>
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
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-800 placeholder:text-neutral-400 outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
              {getFieldError('password') && (
                <p className="mt-1 text-xs text-error-500">{getFieldError('password')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary-600 hover:shadow-lg disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
