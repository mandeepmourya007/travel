'use client'

import { useState } from 'react'
import { Star, MessageCircle, MapPin, BadgeCheck } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { useUpdateOrganizerProfile } from '@/hooks/use-profile'
import type { OrganizerProfileResponse } from '@shared/types/user.types'

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
        <StatCard label="Rating" value={organizerProfile.rating.toFixed(1)} icon={<Star className="h-5 w-5" />} />
        <StatCard label="Reviews" value={organizerProfile.totalReviews} icon={<MessageCircle className="h-5 w-5" />} />
        <StatCard label="Trips" value={organizerProfile.totalTripsCompleted} icon={<MapPin className="h-5 w-5" />} />
      </div>

      {/* Bank account status */}
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        <BadgeCheck className={`h-4 w-4 ${organizerProfile.bankAccountLinked ? 'text-success-500' : 'text-neutral-400'}`} />
        Bank account {organizerProfile.bankAccountLinked ? 'linked' : 'not linked'}
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
