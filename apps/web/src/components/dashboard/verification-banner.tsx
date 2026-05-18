'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, FileText, Upload } from 'lucide-react'
import { useProfile } from '@/hooks/use-profile'
import { DOC_LABELS } from '@shared/constants/upload'
import type { DocumentReviewItem } from '@shared/types/admin.types'

type BannerState = 'loading' | 'approved' | 'pending' | 'revision_required' | 'rejected' | 'hidden'

function getBannerState(
  verificationStatus: string | undefined,
  docReviews: DocumentReviewItem[] | undefined,
): BannerState {
  if (!verificationStatus) return 'hidden'
  if (verificationStatus === 'APPROVED') return 'approved'
  if (verificationStatus === 'REVISION_REQUIRED') return 'revision_required'
  if (verificationStatus === 'REJECTED') return 'rejected'
  if (verificationStatus === 'PENDING') {
    const hasRejected = docReviews?.some((d) => d.status === 'REJECTED')
    return hasRejected ? 'revision_required' : 'pending'
  }
  return 'hidden'
}

export function VerificationBanner() {
  const { data: profile, isLoading } = useProfile()

  if (isLoading) return null

  const orgProfile = profile?.organizerProfile
  if (!orgProfile) return null

  const docReviews = orgProfile.documentReviews as DocumentReviewItem[] | undefined
  const state = getBannerState(orgProfile.verificationStatus, docReviews)

  if (state === 'approved' || state === 'hidden') return null

  const rejectedDocs = docReviews?.filter((d) => d.status === 'REJECTED') ?? []

  return (
    <div
      className={`rounded-xl border p-4 ${
        state === 'revision_required' || state === 'rejected'
          ? 'border-warning-200 bg-warning-50'
          : 'border-primary-200 bg-primary-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {state === 'pending' ? (
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
        )}
        <div className="flex-1 space-y-1">
          {state === 'pending' && (
            <>
              <p className="text-sm font-medium text-primary-700">Documents under review</p>
              <p className="text-xs text-primary-600">
                Your verification documents are being reviewed by our team. You can create trips once all documents are approved.
              </p>
            </>
          )}

          {(state === 'revision_required' || state === 'rejected') && (
            <>
              <p className="text-sm font-medium text-warning-700">
                {rejectedDocs.length > 0 ? 'Some documents need re-upload' : 'Documents require revision'}
              </p>
              {rejectedDocs.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {rejectedDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-1.5 text-xs text-warning-600">
                      <FileText className="h-3 w-3" />
                      <span className="font-medium">{DOC_LABELS[d.docType as keyof typeof DOC_LABELS] ?? d.docType}</span>
                      <span> — needs re-upload</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2">
                <Link
                  href="/dashboard/settings/verification"
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-warning-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-warning-700"
                >
                  <Upload className="h-3 w-3" />
                  Re-upload Documents
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check if the organizer can create trips.
 * Returns true only when all documents are approved.
 */
export function useCanCreateTrips(): { canCreate: boolean; isLoading: boolean; reason?: string } {
  const { data: profile, isLoading } = useProfile()

  if (isLoading) return { canCreate: false, isLoading: true }

  const orgProfile = profile?.organizerProfile
  if (!orgProfile) return { canCreate: false, isLoading: false, reason: 'No organizer profile found' }

  if (orgProfile.verificationStatus === 'APPROVED') {
    return { canCreate: true, isLoading: false }
  }

  return {
    canCreate: false,
    isLoading: false,
    reason: orgProfile.verificationStatus === 'PENDING'
      ? 'Your documents are under review. Trip creation will be enabled once approved.'
      : 'Some of your documents need revision. Please re-upload them to proceed.',
  }
}
