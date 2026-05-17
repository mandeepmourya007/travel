'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Landmark, CheckCircle, AlertTriangle } from 'lucide-react'
import { useProfile, useConnectBankAccount } from '@/hooks/use-profile'
import { connectBankAccountSchema } from '@shared/validators/auth.schema'
import { ZodError } from 'zod'

interface FormState {
  accountHolderName: string
  ifscCode: string
  accountNumber: string
  confirmAccountNumber: string
  beneficiaryName: string
}

const INITIAL_FORM: FormState = {
  accountHolderName: '',
  ifscCode: '',
  accountNumber: '',
  confirmAccountNumber: '',
  beneficiaryName: '',
}

export default function BankSettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const mutation = useConnectBankAccount()

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState<string | null>(null)

  const bankLinked = profile?.organizerProfile?.bankAccountLinked

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setSuccess(null)

    if (form.accountNumber !== form.confirmAccountNumber) {
      setFieldErrors({ confirmAccountNumber: 'Account numbers do not match' })
      return
    }

    let dto
    try {
      dto = connectBankAccountSchema.parse({
        accountHolderName: form.accountHolderName,
        ifscCode: form.ifscCode.toUpperCase(),
        accountNumber: form.accountNumber,
        beneficiaryName: form.beneficiaryName,
      })
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((e) => {
          const key = e.path.join('.')
          errors[key] = e.message
        })
        setFieldErrors(errors)
      }
      return
    }

    // API errors are captured by mutation.error and displayed inline
    const result = await mutation.mutateAsync(dto).catch(() => null)
    if (result) {
      setSuccess(`Bank account linked successfully! Account: ${result.maskedAccountNumber}`)
      setForm(INITIAL_FORM)
    }
  }

  if (profileLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-2">
        <div className="h-8 w-48 rounded-lg skeleton" />
        <div className="card-static space-y-4 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded skeleton" />
              <div className="h-10 rounded-lg skeleton" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-2">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-xl font-bold text-neutral-900">Bank Account</h1>
      </div>

      {bankLinked ? (
        <div className="card-static space-y-4 p-6">
          <div className="flex items-center gap-3 text-success-600">
            <CheckCircle className="h-6 w-6" />
            <div>
              <p className="font-semibold">Bank Account Linked</p>
              <p className="text-sm text-neutral-500">
                Your bank account is connected via Razorpay Route. Payouts will be
                transferred automatically after trip completion.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Status
            </p>
            <p className="mt-1 text-sm font-medium text-success-600">Connected</p>
          </div>

          <p className="text-xs text-neutral-400">
            To update your bank details, please contact support.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card-static space-y-5 p-6">
          <div className="flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 p-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-primary-800">
                Connect your bank account
              </p>
              <p className="mt-0.5 text-xs text-primary-700">
                We use Razorpay Route to securely transfer trip payouts directly to your
                bank account. Your details are encrypted and never stored on our servers.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="accountHolderName" className="label">
              Account Holder Name
            </label>
            <input
              id="accountHolderName"
              name="accountHolderName"
              type="text"
              value={form.accountHolderName}
              onChange={handleChange}
              className="input"
              placeholder="As per bank records"
              required
            />
            {fieldErrors.accountHolderName && (
              <p className="mt-1 text-xs text-error-500">{fieldErrors.accountHolderName}</p>
            )}
          </div>

          <div>
            <label htmlFor="beneficiaryName" className="label">
              Beneficiary Name
            </label>
            <input
              id="beneficiaryName"
              name="beneficiaryName"
              type="text"
              value={form.beneficiaryName}
              onChange={handleChange}
              className="input"
              placeholder="Name for bank transfers"
              required
            />
            {fieldErrors.beneficiaryName && (
              <p className="mt-1 text-xs text-error-500">{fieldErrors.beneficiaryName}</p>
            )}
          </div>

          <div>
            <label htmlFor="ifscCode" className="label">
              IFSC Code
            </label>
            <input
              id="ifscCode"
              name="ifscCode"
              type="text"
              value={form.ifscCode}
              onChange={handleChange}
              className="input uppercase"
              placeholder="e.g. SBIN0001234"
              maxLength={11}
              required
            />
            {fieldErrors.ifscCode && (
              <p className="mt-1 text-xs text-error-500">{fieldErrors.ifscCode}</p>
            )}
          </div>

          <div>
            <label htmlFor="accountNumber" className="label">
              Account Number
            </label>
            <input
              id="accountNumber"
              name="accountNumber"
              type="text"
              inputMode="numeric"
              value={form.accountNumber}
              onChange={handleChange}
              className="input font-mono"
              placeholder="Enter account number"
              maxLength={18}
              required
            />
            {fieldErrors.accountNumber && (
              <p className="mt-1 text-xs text-error-500">{fieldErrors.accountNumber}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmAccountNumber" className="label">
              Confirm Account Number
            </label>
            <input
              id="confirmAccountNumber"
              name="confirmAccountNumber"
              type="text"
              inputMode="numeric"
              value={form.confirmAccountNumber}
              onChange={handleChange}
              className="input font-mono"
              placeholder="Re-enter account number"
              maxLength={18}
              required
            />
            {fieldErrors.confirmAccountNumber && (
              <p className="mt-1 text-xs text-error-500">{fieldErrors.confirmAccountNumber}</p>
            )}
          </div>

          {mutation.error && (
            <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
              <p className="text-sm text-error-700">
                {mutation.error instanceof Error ? mutation.error.message : 'Failed to connect bank account'}
              </p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 p-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
              <p className="text-sm text-success-700">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Connecting...
              </>
            ) : (
              <>
                <Landmark className="h-4 w-4" />
                Connect Bank Account
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
