'use client'

import Link from 'next/link'
import { AlertTriangle, Landmark, Clock, ExternalLink, FileText } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'
import { getDocCount, areDocsComplete } from '@/lib/organizer-utils'
import { REQUIRED_DOC_COUNT } from '@shared/constants'

/**
 * Contextual alert banners for the organizer dashboard.
 * Shows verification pending + bank account not linked warnings.
 */
export function DashboardAlerts() {
  const { data: profile } = useProfile()

  if (!profile?.organizerProfile) return null

  const { verificationStatus, bankAccountLinked } = profile.organizerProfile

  const alerts: React.ReactNode[] = []

  if (verificationStatus === 'PENDING') {
    alerts.push(
      <div
        key="verification"
        className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4"
      >
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-warning-800">
            Verification Pending
          </p>
          <p className="mt-0.5 text-sm text-warning-700">
            Your organizer profile is under review by our admin team. You&apos;ll be able to
            create trips once your profile is approved.
          </p>
        </div>
      </div>,
    )
  }

  if (verificationStatus === 'REJECTED') {
    alerts.push(
      <div
        key="rejected"
        className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 p-4"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-error-800">
            Verification Rejected
          </p>
          <p className="mt-0.5 text-sm text-error-700">
            Your organizer profile was not approved. Please update your profile details and
            contact support for re-verification.
          </p>
          <Link
            href="/profile"
            prefetch={false}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-error-700 underline underline-offset-2 hover:text-error-800"
          >
            Update Profile
          </Link>
        </div>
      </div>,
    )
  }

  const docs = profile.organizerProfile.documents
  const docCount = getDocCount(docs)

  if (!areDocsComplete(docs)) {
    alerts.push(
      <div
        key="docs"
        className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4"
      >
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-warning-800">
            Verification Documents Incomplete ({docCount}/{REQUIRED_DOC_COUNT})
          </p>
          <p className="mt-0.5 text-sm text-warning-700">
            Upload your Aadhaar card (front & back) and PAN card for identity verification.
          </p>
          <Link
            href="/dashboard/settings/verification"
            prefetch={false}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-warning-700 bg-white px-3 py-1.5 text-sm font-semibold text-warning-800 transition-colors hover:bg-warning-100"
          >
            <FileText className="h-3.5 w-3.5" />
            Upload Documents
          </Link>
        </div>
      </div>,
    )
  }

  if (!bankAccountLinked) {
    alerts.push(
      <div
        key="bank"
        className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4"
      >
        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary-800">
            Bank Account Not Linked
          </p>
          <p className="mt-0.5 text-sm text-primary-700">
            Connect your bank account to receive payouts. Travelers cannot book your trips
            until your bank account is linked.
          </p>
          <Link
            href="/dashboard/settings/bank"
            prefetch={false}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary-700 bg-white px-3 py-1.5 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100"
          >
            <Landmark className="h-3.5 w-3.5" />
            Connect Bank Account
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>,
    )
  }

  if (alerts.length === 0) return null

  return <div className="mb-6 space-y-3">{alerts}</div>
}
