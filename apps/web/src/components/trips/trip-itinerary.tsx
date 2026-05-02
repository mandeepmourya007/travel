import { MapPin } from 'lucide-react'
import type { ItineraryDay } from '@shared/types/trip.types'

interface TripItineraryProps {
  itinerary: ItineraryDay[]
}

export function TripItinerary({ itinerary }: TripItineraryProps) {
  if (!itinerary.length) return null

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">Itinerary</h2>
      <div className="space-y-0">
        {itinerary.map((day, index) => (
          <div key={index} className="relative flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white">
                {day.day}
              </div>
              {index < itinerary.length - 1 && (
                <div className="w-0.5 flex-1 bg-primary-200" />
              )}
            </div>

            {/* Content */}
            <div className="pb-8 flex-1">
              <h3 className="font-semibold text-neutral-800">{day.title}</h3>
              {day.description && (
                <p className="mt-1 text-sm text-neutral-500 leading-relaxed">
                  {day.description}
                </p>
              )}
              {day.activities && day.activities.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {day.activities.map((activity, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary-400 shrink-0" />
                      <span>
                        {activity.time && <span className="font-medium text-neutral-700">{activity.time} — </span>}
                        {activity.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
