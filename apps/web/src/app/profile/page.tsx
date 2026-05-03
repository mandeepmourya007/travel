'use client'

import { useProfile } from '@/hooks/use-profile'
import { ProfileHeader } from '@/components/profile/profile-header'
import { EditUserProfileForm } from '@/components/profile/edit-user-profile-form'
import { OrganizerProfileCard } from '@/components/profile/organizer-profile-card'
import { ProfileSkeleton } from '@/components/profile/profile-skeleton'
import { ErrorState } from '@/components/shared/data-states'

export default function ProfilePage() {
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
      <EditUserProfileForm profile={profile} />
      {profile.organizerProfile && (
        <OrganizerProfileCard organizerProfile={profile.organizerProfile} />
      )}
    </div>
  )
}
