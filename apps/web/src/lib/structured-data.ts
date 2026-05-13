import type { TripDetail, TripSummary } from '@shared/types/trip.types'

/**
 * Schema.org JSON-LD builder functions for SEO structured data.
 * All functions return plain objects — render via <script type="application/ld+json">.
 */

export function buildTripJsonLd(trip: TripDetail, siteUrl: string) {
  const availability = (trip.maxGroupSize - trip.currentBookings) > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/SoldOut'

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: trip.title,
    description: trip.description,
    startDate: trip.startDate,
    endDate: trip.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: trip.destination.name,
    },
    image: trip.photos.length > 0 ? trip.photos : undefined,
    url: `${siteUrl}/trips/${trip.slug}`,
    organizer: {
      '@type': 'Organization',
      name: trip.organizer.businessName,
      url: `${siteUrl}/trips/organizers/${trip.organizer.slug}`,
    },
    offers: {
      '@type': 'Offer',
      price: trip.pricePerPerson.toString(),
      priceCurrency: 'INR',
      availability,
      url: `${siteUrl}/trips/${trip.slug}`,
      validFrom: trip.startDate,
    },
  }

  if (trip.organizer.totalReviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: trip.organizer.rating.toFixed(1),
      reviewCount: trip.organizer.totalReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (trip.reviews.length > 0) {
    jsonLd.review = trip.reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.overallRating,
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        '@type': 'Person',
        name: r.user.name,
      },
      datePublished: r.createdAt,
      ...(r.comment && { reviewBody: r.comment }),
    }))
  }

  return jsonLd
}

interface BreadcrumbItem {
  name: string
  url: string
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function buildWebsiteJsonLd(siteUrl: string, appName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appName,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/trips?destination={search_term}`,
      },
      'query-input': 'required name=search_term',
    },
  }
}

export function buildDestinationJsonLd(destination: {
  name: string
  state: string
  description?: string | null
  photoUrl?: string | null
}, siteUrl: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destination.name,
    description: destination.description || `Group trips to ${destination.name}, ${destination.state}`,
    ...(destination.photoUrl && { image: destination.photoUrl }),
    url: `${siteUrl}/destinations/${slug}`,
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: destination.state,
    },
  }
}

export function buildOrganizerProfileJsonLd(organizer: {
  businessName: string
  description?: string | null
  rating: number
  totalReviews: number
}, siteUrl: string, organizerSlug: string, appName: string) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: organizer.businessName,
    description: organizer.description || `Verified trip organizer on ${appName}`,
    url: `${siteUrl}/trips/organizers/${organizerSlug}`,
  }

  if (organizer.totalReviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: organizer.rating.toFixed(1),
      reviewCount: organizer.totalReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return jsonLd
}

export function buildOrganizationJsonLd(siteUrl: string, appName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: appName,
    url: siteUrl,
    description: 'Compare group trips, book safely with escrow-protected payments, and travel with verified organizers.',
  }
}

export function buildItemListJsonLd(trips: TripSummary[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: trips.map((trip, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/trips/${trip.slug}`,
      name: trip.title,
    })),
  }
}

export function buildFaqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
