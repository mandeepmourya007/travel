'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { usePopularDestinations } from '@/hooks/use-destinations'

export function PopularDestinations() {
  const { data: destinations, isLoading, error } = usePopularDestinations()

  if (isLoading) {
    return (
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-neutral-800">
            Popular Destinations from Pune
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-36 rounded-xl"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-neutral-800">
            Popular Destinations from Pune
          </h2>
          <p className="mt-8 text-center text-neutral-400 py-12">
            Could not load destinations. Please try again later.
          </p>
        </div>
      </section>
    )
  }

  if (!destinations?.length) return null

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-neutral-800">
            Popular Destinations from Pune
          </h2>
          <Link
            href="/destinations"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {destinations.map((dest) => (
            <Link
              key={dest.id}
              href={`/destinations/${dest.slug}`}
              className="group relative h-36 overflow-hidden rounded-xl bg-neutral-200"
            >
              {dest.photoUrl && (
                <Image
                  src={dest.photoUrl}
                  alt={dest.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-4">
                <h3 className="font-display text-lg font-bold text-white">{dest.name}</h3>
                <p className="flex items-center gap-1 text-sm text-white/80">
                  <MapPin className="h-3.5 w-3.5" />
                  {dest.tripCount} trips
                </p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/destinations"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            View all destinations →
          </Link>
        </div>
      </div>
    </section>
  )
}
