import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchApi, getPopularTripsForStaticParams } from '@/lib/api-server'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildOrganizerProfileJsonLd, buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { OrganizerProfileClient } from '@/components/trips/organizer-profile-client'
import type { OrganizerPublicProfileResponse } from '@shared/types/organizer.types'

/** CUIDs (Prisma default) start with 'cl' or 'cm' followed by 23+ alphanumeric chars */
const CUID_PATTERN = /^c[lm][a-z0-9]{23,}$/i

interface OrganizerPageProps {
  params: Promise<{ slug: string }>
}

const getOrganizerProfile = cache(async (slug: string): Promise<OrganizerPublicProfileResponse | null> => {
  try {
    return await fetchApi<OrganizerPublicProfileResponse>(
      `/trips/organizers/slug/${slug}?tripsLimit=12`,
      { revalidate: 300 },
    )
  } catch {
    return null
  }
})

/** Legacy lookup by organizer ID — used for redirecting old URLs */
const getOrganizerById = cache(async (id: string): Promise<OrganizerPublicProfileResponse | null> => {
  try {
    return await fetchApi<OrganizerPublicProfileResponse>(
      `/trips/organizers/${id}?tripsLimit=1`,
      { revalidate: 3600 },
    )
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: OrganizerPageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await getOrganizerProfile(slug)
  if (!data) {
    return { title: 'Organizer Not Found' }
  }

  const { organizer } = data
  const title = `${organizer.businessName} — Verified Trip Organizer | ${APP_NAME}`
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // Original fallback: `${organizer.businessName} — ${organizer.totalTripsCompleted} trips completed, rated ${organizer.rating}/5. Book safely with SafePay protection.`
  const raw = organizer.description
    || `${organizer.businessName} — ${organizer.totalTripsCompleted} trips completed, rated ${organizer.rating}/5. Book safely with secure payments.`
  const description = raw.length > 160
    ? raw.slice(0, raw.lastIndexOf(' ', 160)) + '…'
    : raw

  return {
    title,
    description,
    alternates: {
      canonical: `/trips/organizers/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/trips/organizers/${slug}`,
    },
  }
}

export async function generateStaticParams() {
  try {
    const trips = await getPopularTripsForStaticParams()
    const slugs = trips
      .map((t) => t.organizer?.slug)
      .filter((s): s is string => !!s)
    return [...new Set(slugs)].map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export default async function OrganizerPublicProfilePage({ params }: OrganizerPageProps) {
  const { slug } = await params
  const data = await getOrganizerProfile(slug)

  // Legacy redirect: if slug looks like a CUID, try fetching by ID and redirect to canonical slug URL
  if (!data && CUID_PATTERN.test(slug)) {
    const legacyData = await getOrganizerById(slug)
    if (legacyData) {
      redirect(`/trips/organizers/${legacyData.organizer.slug}`)
    }
  }

  if (!data) {
    notFound()
  }

  const { organizer } = data
  const organizerJsonLd = buildOrganizerProfileJsonLd(organizer, SITE_URL, slug, APP_NAME)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Trips', url: `${SITE_URL}/trips` },
    { name: organizer.businessName, url: `${SITE_URL}/trips/organizers/${slug}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizerJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <OrganizerProfileClient initialData={data} organizerId={organizer.id} />
    </>
  )
}
