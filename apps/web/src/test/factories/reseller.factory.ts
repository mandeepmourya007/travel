import type {
  ResellerMainLinkDto,
  ResellerMainLinkWithEarningsDto,
  ResellerSublinkDto,
  ResellerLeadRow,
  ResolvedSublinkDto,
  ResellerSearchResultItem,
  OrganizerSearchResultItem,
} from '@shared/types/reseller.types'

let counter = 0

export function resetResellerFactory() {
  counter = 0
}

export function makeMainLink(overrides: Partial<ResellerMainLinkDto> = {}): ResellerMainLinkDto {
  counter++
  return {
    id: `link_${counter}`,
    token: `main-tok-${counter}`,
    tripId: `trip_${counter}`,
    tripTitle: `Goa Trip ${counter}`,
    tripSlug: `goa-trip-${counter}`,
    organizerId: `org_${counter}`,
    resellerId: `reseller_${counter}`,
    resellerEmail: `reseller${counter}@example.com`,
    resellerName: `Resale Rani ${counter}`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    sublinkCount: 1,
    bookingCount: 0,
    totalMarkupAmount: 0,
    ...overrides,
  }
}

export function makeMainLinkWithEarnings(
  overrides: Partial<ResellerMainLinkWithEarningsDto> = {},
): ResellerMainLinkWithEarningsDto {
  const base = makeMainLink()
  return {
    ...base,
    tripPhoto: null,
    totalMarkupAmount: 0,
    organizerName: `Organizer ${base.organizerId}`,
    ...overrides,
  }
}

export function makeSublink(overrides: Partial<ResellerSublinkDto> = {}): ResellerSublinkDto {
  counter++
  return {
    id: `sub_${counter}`,
    token: `sub-tok-${counter}`,
    mainLinkId: `link_${counter}`,
    tripId: `trip_${counter}`,
    tripTitle: `Goa Trip ${counter}`,
    tripSlug: `goa-trip-${counter}`,
    resellerId: `reseller_${counter}`,
    markupAmount: 500,
    label: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    bookingCount: 0,
    totalMarkupAmount: 0,
    ...overrides,
  }
}

export function makeLeadRow(overrides: Partial<ResellerLeadRow> = {}): ResellerLeadRow {
  counter++
  return {
    sublinkId: `sub_${counter}`,
    sublinkToken: `sub-tok-${counter}`,
    label: null,
    mainLinkId: `link_${counter}`,
    tripId: `trip_${counter}`,
    tripTitle: `Goa Trip ${counter}`,
    tripSlug: `goa-trip-${counter}`,
    resellerId: `reseller_${counter}`,
    resellerName: `Resale Rani ${counter}`,
    resellerEmail: `reseller${counter}@example.com`,
    organizerId: `org_${counter}`,
    organizerName: `Organizer ${counter}`,
    markupAmount: 500,
    bookingCount: 2,
    totalTravelers: 4,
    totalMarkupAmount: 2000,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeResolvedSublink(overrides: Partial<ResolvedSublinkDto> = {}): ResolvedSublinkDto {
  return {
    tripId: 'trip_1',
    tripSlug: 'goa-trip-1',
    effectivePrice: 5500,
    resellerName: 'Resale Rani',
    ...overrides,
  }
}

export function makeResellerSearchResult(overrides: Partial<ResellerSearchResultItem> = {}): ResellerSearchResultItem {
  counter++
  return { id: `reseller_${counter}`, name: `Resale Rani ${counter}`, email: `reseller${counter}@example.com`, ...overrides }
}

export function makeOrganizerSearchResult(overrides: Partial<OrganizerSearchResultItem> = {}): OrganizerSearchResultItem {
  counter++
  return { id: `org_${counter}`, businessName: `Organizer ${counter}`, email: `org${counter}@example.com`, ...overrides }
}
