import { CheckCircle, Calendar, Compass, Users } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'
import type { OrganizerPublicProfile } from '@shared/types/organizer.types'

interface OrganizerProfileHeaderProps {
  organizer: OrganizerPublicProfile
}

export function OrganizerProfileHeader({ organizer }: OrganizerProfileHeaderProps) {
  return (
    <section className="rounded-xl border border-neutral-100 bg-white p-6">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Avatar */}
        <div className="h-16 w-16 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700 font-display">
          {organizer.businessName.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + verified */}
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-neutral-800 sm:text-2xl truncate">
              {organizer.businessName}
            </h1>
            {organizer.verified && (
              <CheckCircle className="h-5 w-5 text-primary-500 shrink-0" />
            )}
          </div>

          {/* Rating */}
          {organizer.totalReviews > 0 && (
            <div className="mt-1.5">
              <StarRating
                rating={organizer.rating}
                size="md"
                showValue
                count={organizer.totalReviews}
              />
            </div>
          )}

          {/* Description */}
          {organizer.description && (
            <p className="mt-3 text-sm text-neutral-600 leading-relaxed line-clamp-3">
              {organizer.description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-neutral-400" />
              {organizer.totalTripsCompleted} trips completed
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-neutral-400" />
              {organizer.totalReviews} reviews
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-neutral-400" />
              Member since{' '}
              {new Date(organizer.memberSince).toLocaleDateString('en-IN', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
