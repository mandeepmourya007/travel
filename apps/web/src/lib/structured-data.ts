import type { TripDetail, TripSummary } from '@shared/types/trip.types'

/**
 * Schema.org JSON-LD builder functions for SEO structured data.
 * All functions return plain objects — render via <script type="application/ld+json">.
 *
 * TouristTrip is the correct schema.org type for group tour packages (not Event).
 * It surfaces in Google rich results, Bing travel cards, and AI answer citations
 * (ChatGPT, Perplexity, Gemini) when properly populated.
 */

// ─── Trip / TouristTrip ───────────────────────────────────────────────────────

export function buildTripJsonLd(trip: TripDetail, siteUrl: string) {
  const seatsLeft = trip.maxGroupSize - trip.currentBookings
  const availability = seatsLeft > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/SoldOut'

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: trip.description,
    url: `${siteUrl}/trips/${trip.slug}`,
    // Freshness signal — critical for Perplexity and AI citation ranking
    dateModified: new Date().toISOString(),

    // TouristTrip-specific: semantic type matching for AI intent resolution
    touristType: ['Group Travel', 'Adventure', 'Cultural'],

    // Itinerary: destination as a TouristAttraction for destination-level SEO
    itinerary: {
      '@type': 'TouristAttraction',
      name: trip.destination.name,
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: trip.destination.state ?? 'India',
      },
    },

    // Language signals for India's multilingual market
    availableLanguage: ['English', 'Hindi'],
    inLanguage: 'en',

    // Group size signals — AI extracts this for travel intent matching
    maximumAttendeeCapacity: trip.maxGroupSize,
    remainingAttendeeCapacity: seatsLeft,

    // Images
    ...(trip.photos.length > 0 && { image: trip.photos }),

    // Organizer
    organizer: {
      '@type': 'Organization',
      name: trip.organizer.businessName,
      url: `${siteUrl}/trips/organizers/${trip.organizer.slug}`,
    },

    // Pricing — AggregateOffer surfaces in Google Shopping & AI travel answers
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: trip.pricePerPerson.toString(),
      offerCount: seatsLeft.toString(),
      availability,
      url: `${siteUrl}/trips/${trip.slug}`,
    },
  }

  // Dates (only if set — open-dated trips omit these)
  if (trip.startDate) jsonLd.startDate = trip.startDate
  if (trip.endDate) jsonLd.endDate = trip.endDate

  // Ratings — key trust signal for both Google rich results and AI citations
  if (trip.organizer.totalReviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: trip.organizer.rating.toFixed(1),
      reviewCount: trip.organizer.totalReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }

  // Top reviews — AI uses reviewer names + text as authenticity signals
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

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

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

// ─── WebSite (with SearchAction for Sitelinks Searchbox) ─────────────────────

export function buildWebsiteJsonLd(siteUrl: string, appName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appName,
    url: siteUrl,
    description: `India's group travel aggregator — compare group trips from verified organizers, book with SafePay-protected payments, and travel with confidence.`,
    dateModified: new Date().toISOString(),
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/trips?q={search_term}`,
      },
      'query-input': 'required name=search_term',
    },
  }
}

// ─── TouristDestination ───────────────────────────────────────────────────────

export function buildDestinationJsonLd(
  destination: {
    name: string
    state: string
    description?: string | null
    photoUrl?: string | null
  },
  siteUrl: string,
  slug: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destination.name,
    description: destination.description || `Group trips to ${destination.name}, ${destination.state}, India. Compare packages, read verified traveler reviews, and book with SafePay protection.`,
    ...(destination.photoUrl && { image: destination.photoUrl }),
    url: `${siteUrl}/destinations/${slug}`,
    dateModified: new Date().toISOString(),
    touristType: ['Group Travel', 'Adventure', 'Cultural'],
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: destination.state,
      containedInPlace: {
        '@type': 'Country',
        name: 'India',
      },
    },
  }
}

// ─── Organizer Profile ────────────────────────────────────────────────────────

export function buildOrganizerProfileJsonLd(
  organizer: {
    businessName: string
    description?: string | null
    rating: number
    totalReviews: number
  },
  siteUrl: string,
  organizerSlug: string,
  appName: string,
) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: organizer.businessName,
    description: organizer.description || `Verified group trip organizer on ${appName}. KYC-verified, SafePay-protected payouts.`,
    url: `${siteUrl}/trips/organizers/${organizerSlug}`,
    dateModified: new Date().toISOString(),
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
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

// ─── Platform Organization ────────────────────────────────────────────────────

export function buildOrganizationJsonLd(siteUrl: string, appName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: appName,
    url: siteUrl,
    logo: `${siteUrl}/icon-512.png`,
    description: `India's group travel aggregator. Compare group trips from verified organizers, book with SafePay-protected payments, and travel with confidence across 14+ destinations.`,
    foundingDate: '2024',
    inLanguage: 'en-IN',
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@safarnama.in',
      availableLanguage: ['English', 'Hindi'],
    },
    knowsAbout: [
      'Group Travel India',
      'Group Tour Packages',
      'Weekend Trips from Pune',
      'Adventure Trekking India',
      'Himalayan Group Treks',
      'SafePay Travel Payments',
    ],
  }
}

// ─── Trip List (ItemList) ─────────────────────────────────────────────────────

export function buildItemListJsonLd(trips: TripSummary[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Group Trips India',
    description: 'Curated group travel packages across India from verified organizers.',
    itemListElement: trips.map((trip, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/trips/${trip.slug}`,
      name: trip.title,
    })),
  }
}

// ─── Destination List (ItemList) ──────────────────────────────────────────────

export function buildDestinationListJsonLd(
  destinations: { name: string; slug: string; description?: string | null }[],
  siteUrl: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Group Trip Destinations India',
    description: 'Popular group travel destinations across India — Goa, Manali, Ladakh, Spiti Valley, Rishikesh & more.',
    itemListElement: destinations.map((d, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/destinations/${d.slug}`,
      name: d.name,
      ...(d.description && { description: d.description.slice(0, 200) }),
    })),
  }
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

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
