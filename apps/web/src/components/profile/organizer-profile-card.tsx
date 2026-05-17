'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, MessageCircle, MapPin, CheckCircle2, Circle, Landmark, ShieldCheck, FileText } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { useUpdateOrganizerProfile } from '@/hooks/use-profile'
import { getDocCount, areDocsComplete } from '@/lib/organizer-utils'
import type { OrganizerProfileResponse, OrganizerDocuments } from '@shared/types/user.types'

interface OrganizerProfileCardProps {
  organizerProfile: OrganizerProfileResponse
}

const VERIFICATION_BADGE: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'Verified', className: 'badge-success' },
  PENDING: { label: 'Pending', className: 'badge-warning' },
  REJECTED: { label: 'Rejected', className: 'badge-error' },
}

export function OrganizerProfileCard({ organizerProfile }: OrganizerProfileCardProps) {
  const [editing, setEditing] = useState(false)
  const [businessName, setBusinessName] = useState(organizerProfile.businessName)
  const [description, setDescription] = useState(organizerProfile.description ?? '')
  const mutation = useUpdateOrganizerProfile()

  const badge = VERIFICATION_BADGE[organizerProfile.verificationStatus] ?? VERIFICATION_BADGE.PENDING

  const hasChanges =
    businessName !== organizerProfile.businessName ||
    description !== (organizerProfile.description ?? '')
  const canSubmit =
    hasChanges && businessName.trim().length >= 2 && !mutation.isPending

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const dto: { businessName?: string; description?: string } = {}
    if (businessName !== organizerProfile.businessName) dto.businessName = businessName.trim()
    if (description !== (organizerProfile.description ?? '')) dto.description = description.trim()

    mutation.mutate(dto, {
      onSuccess: () => setEditing(false),
    })
  }

  return (
    <div className="card-static space-y-4 p-6" data-testid="organizer-profile-card">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">Organizer Details</h3>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>

      {/* Stats row — reuses StatCard from dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard compact label="Rating" value={organizerProfile.rating.toFixed(1)} icon={<Star className="h-4 w-4" />} />
        <StatCard compact label="Reviews" value={organizerProfile.totalReviews} icon={<MessageCircle className="h-4 w-4" />} />
        <StatCard compact label="Trips" value={organizerProfile.totalTripsCompleted} icon={<MapPin className="h-4 w-4" />} />
      </div>

      {/* Setup checklist */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Setup Checklist</p>

        <div className="flex items-center gap-3">
          {organizerProfile.verificationStatus === 'APPROVED' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success-500" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-neutral-300" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-800">Admin Verification</span>
            </div>
            <p className="text-xs text-neutral-500">
              {organizerProfile.verificationStatus === 'APPROVED'
                ? 'Your profile has been verified by our team'
                : organizerProfile.verificationStatus === 'REJECTED'
                  ? 'Verification rejected — please update your profile'
                  : 'Under review by our admin team'}
            </p>
          </div>
          <span className={`badge ${badge.className} text-xs`}>{badge.label}</span>
        </div>

        <hr className="border-neutral-100" />

        <DocumentsChecklistItem documents={organizerProfile.documents} />

        <hr className="border-neutral-100" />

        <div className="flex items-center gap-3">
          {organizerProfile.bankAccountLinked ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success-500" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-neutral-300" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Landmark className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-800">Bank Account</span>
            </div>
            <p className="text-xs text-neutral-500">
              {organizerProfile.bankAccountLinked
                ? 'Connected via Razorpay Route'
                : 'Required to receive trip payouts'}
            </p>
          </div>
          {organizerProfile.bankAccountLinked ? (
            <span className="badge badge-success text-xs">Linked</span>
          ) : (
            <Link
              href="/dashboard/settings/bank"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Connect
            </Link>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label htmlFor="org-business" className="label">
              Business Name
            </label>
            <input
              id="org-business"
              data-testid="org-business-input"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="input"
              minLength={2}
              maxLength={100}
            />
          </div>
          <div>
            <label htmlFor="org-description" className="label">
              Description
            </label>
            <textarea
              id="org-description"
              data-testid="org-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-20"
              maxLength={500}
            />
          </div>
          {mutation.error && (
            <p data-testid="org-save-error" className="text-sm text-error-500">
              {mutation.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="org-save-btn"
              disabled={!canSubmit}
              className="btn-primary"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setBusinessName(organizerProfile.businessName)
                setDescription(organizerProfile.description ?? '')
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-800">{organizerProfile.businessName}</p>
          {organizerProfile.description && (
            <p className="text-sm text-neutral-600">{organizerProfile.description}</p>
          )}
          <button
            onClick={() => setEditing(true)}
            data-testid="org-edit-btn"
            className="btn-outline text-sm"
          >
            Edit Details
          </button>
        </div>
      )}
    </div>
  )
}

function DocumentsChecklistItem({ documents }: { documents: OrganizerDocuments | null }) {
  const docCount = getDocCount(documents)
  const allUploaded = areDocsComplete(documents)

  return (
    <div className="flex items-center gap-3">
      {allUploaded ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success-500" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-neutral-300" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-800">Verification Documents</span>
        </div>
        <p className="text-xs text-neutral-500">
          {allUploaded
            ? 'Aadhaar (both sides) and PAN card uploaded'
            : `${docCount}/3 documents uploaded — Aadhaar (front & back) + PAN required`}
        </p>
      </div>
      {allUploaded ? (
        <span className="badge badge-success text-xs">Done</span>
      ) : (
        <Link
          href="/dashboard/settings/verification"
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          Upload
        </Link>
      )}
    </div>
  )
}
