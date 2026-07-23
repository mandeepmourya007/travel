'use client'

import { useProfile } from '@/hooks/use-profile'
import { ProfileHeader } from '@/components/profile/profile-header'
import { EditProfileModal } from '@/components/profile/edit-profile-modal'
import { OrganizerProfileCard } from '@/components/profile/organizer-profile-card'
import { ProfileSkeleton } from '@/components/profile/profile-skeleton'
import { ErrorState } from '@/components/shared/data-states'
import { AuthGuard } from '@/components/shared/auth-guard'

function ProfileContent() {
  const { data: profile, isLoading, error, refetch } = useProfile()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <ProfileSkeleton />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Failed to load profile"
          message={error?.message ?? 'Something went wrong'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-neutral-900">My Profile</h1>
      <ProfileHeader profile={profile} />

      <div className="card-static space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900">Profile Details</h3>
          <EditProfileModal profile={profile} />
        </div>
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-neutral-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-neutral-500">Name</p>
            <p className="text-sm font-medium text-neutral-800">{profile.name}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Email</p>
            <p className="text-sm font-medium text-neutral-800">{profile.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Phone</p>
            <p className="text-sm font-medium text-neutral-800">{profile.phone ?? '—'}</p>
          </div>
        </div>
      </div>

      {profile.organizerProfile && (
        <OrganizerProfileCard organizerProfile={profile.organizerProfile} />
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  )
}
