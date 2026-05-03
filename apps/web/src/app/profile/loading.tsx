import { ProfileSkeleton } from '@/components/profile/profile-skeleton'

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <ProfileSkeleton />
    </div>
  )
}
