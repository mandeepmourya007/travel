import { Avatar } from '@/components/shared/avatar'
import type { UserProfileResponse } from '@shared/types/user.types'

interface ProfileHeaderProps {
  profile: UserProfileResponse
}

function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr)
  return `Member since ${date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="card-static flex items-center gap-4 p-6" data-testid="profile-header">
      <Avatar
        name={profile.name}
        src={profile.avatarUrl}
        size="lg"
        color={profile.role === 'ORGANIZER' ? 'accent' : 'primary'}
      />
      <div>
        <h2 className="text-lg font-bold text-neutral-900">{profile.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={
              profile.role === 'ORGANIZER' ? 'badge badge-accent' : 'badge badge-primary'
            }
          >
            {profile.role}
          </span>
          {profile.phoneVerified && (
            <span className="badge badge-success">Phone Verified</span>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {formatMemberSince(profile.createdAt)}
        </p>
      </div>
    </div>
  )
}
