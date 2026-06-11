import { memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import type { Destination } from '@shared/types/destination.types'

interface DestinationCardProps {
  destination: Destination
}

export const DestinationCard = memo(function DestinationCard({ destination }: DestinationCardProps) {
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      prefetch={false}
      className="group relative block h-48 overflow-hidden rounded-xl bg-neutral-200"
    >
      {destination.photoUrl ? (
        <Image
          src={destination.photoUrl}
          alt={destination.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          quality={60}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary-400 to-primary-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 p-4">
        <h3 className="font-display text-lg font-bold text-white">
          {destination.name}
        </h3>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-white/80">
          <MapPin className="h-3.5 w-3.5" />
          {destination.state}
        </p>
      </div>
      {destination.tripCount > 0 && (
        <span className="absolute top-3 right-3 badge bg-white/90 text-neutral-800 text-xs font-semibold backdrop-blur-sm">
          {destination.tripCount} {destination.tripCount === 1 ? 'trip' : 'trips'}
        </span>
      )}
    </Link>
  )
})
