import Link from 'next/link'
import { CheckCircle, Calendar, Users } from 'lucide-react'
import { StarRating } from '@/components/shared/star-rating'

interface OrganizerInfo {
  id: string
  slug: string
  businessName: string
  verified: boolean
  rating: number
  totalReviews: number
  totalTrips?: number
  memberSince?: string
}

interface TripOrganizerCardProps {
  organizer: OrganizerInfo
}

export function TripOrganizerCard({ organizer }: TripOrganizerCardProps) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
        About the Organizer
      </h2>
      <div className="rounded-xl border border-neutral-100 p-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-700">
            {organizer.businessName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-800">
                {organizer.businessName}
              </span>
              {organizer.verified && (
                <CheckCircle className="h-4 w-4 text-primary-500" />
              )}
            </div>
            {organizer.totalReviews > 0 && (
              <StarRating
                rating={organizer.rating}
                size="sm"
                showValue
                count={organizer.totalReviews}
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-6 text-sm text-neutral-500">
          {organizer.totalTrips !== undefined && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-neutral-400" />
              {organizer.totalTrips} trips
            </span>
          )}
          {organizer.memberSince && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-neutral-400" />
              Since{' '}
              {new Date(organizer.memberSince).toLocaleDateString('en-IN', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        <Link
          href={`/trips/organizers/${organizer.slug}`}
          className="mt-4 block text-center btn-secondary text-sm"
        >
          View All Trips by {organizer.businessName}
        </Link>
      </div>
    </section>
  )
}
