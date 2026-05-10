import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchApi } from '@/lib/api-server'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildOrganizerProfileJsonLd, buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { OrganizerProfileClient } from '@/components/trips/organizer-profile-client'
import type { OrganizerPublicProfileResponse } from '@shared/types/organizer.types'

interface OrganizerPageProps {
  params: { organizerId: string }
}

const getOrganizerProfile = cache(async (id: string): Promise<OrganizerPublicProfileResponse | null> => {
  try {
    return await fetchApi<OrganizerPublicProfileResponse>(
      `/trips/organizers/${id}?tripsLimit=12`,
      { revalidate: 300 },
    )
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: OrganizerPageProps): Promise<Metadata> {
  const data = await getOrganizerProfile(params.organizerId)
  if (!data) {
    return { title: 'Organizer Not Found' }
  }

  const { organizer } = data
  const title = `${organizer.businessName} — Verified Trip Organizer | ${APP_NAME}`
  const raw = organizer.description
    || `${organizer.businessName} — ${organizer.totalTripsCompleted} trips completed, rated ${organizer.rating}/5. Book safely with escrow protection.`
  const description = raw.length > 160
    ? raw.slice(0, raw.lastIndexOf(' ', 160)) + '…'
    : raw

  return {
    title,
    description,
    alternates: {
      canonical: `/trips/organizers/${params.organizerId}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/trips/organizers/${params.organizerId}`,
    },
  }
}

export default async function OrganizerPublicProfilePage({ params }: OrganizerPageProps) {
  const data = await getOrganizerProfile(params.organizerId)

  if (!data) {
    notFound()
  }

  const { organizer } = data
  const organizerJsonLd = buildOrganizerProfileJsonLd(organizer, SITE_URL, params.organizerId)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Trips', url: `${SITE_URL}/trips` },
    { name: organizer.businessName, url: `${SITE_URL}/trips/organizers/${params.organizerId}` },
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
      <OrganizerProfileClient initialData={data} organizerId={params.organizerId} />
    </>
  )
}
