'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'
import { BankAccountForm } from '@/components/dashboard/bank-account-form'

export default function BankSettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile()

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

      <BankAccountForm bankAccountLinked={profile?.organizerProfile?.bankAccountLinked} />
    </div>
  )
}
