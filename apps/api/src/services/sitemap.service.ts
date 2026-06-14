import type { TripRepository } from '../repositories/trip.repository'
import type { DestinationRepository } from '../repositories/destination.repository'
import type { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'

/**
 * Lightweight service for sitemap-data generation.
 *
 * Previously, the /sitemap-data route called repositories directly from an
 * inline handler in server.ts (P3-2 audit finding). This service restores the
 * Controller→Service→Repository layering that holds everywhere else.
 */
export class SitemapService {
  constructor(
    private tripRepo: TripRepository,
    private destinationRepo: DestinationRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
  ) {}

  async getSitemapData() {
    const [trips, destinations, organizers] = await Promise.all([
      this.tripRepo.findSlugsForSitemap(),
      this.destinationRepo.findSlugsForSitemap(),
      this.organizerProfileRepo.findIdsForSitemap(),
    ])
    return { trips, destinations, organizers }
  }
}
