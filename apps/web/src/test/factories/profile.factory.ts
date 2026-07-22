import type { UserProfileResponse, OrganizerProfileResponse } from '@shared/types/user.types'

export function makeOrganizerProfile(overrides: Partial<OrganizerProfileResponse> = {}): OrganizerProfileResponse {
  return {
    id: 'org-1',
    slug: 'trek-india-adventures',
    businessName: 'Trek India Adventures',
    description: 'Best treks in India',
    verificationStatus: 'APPROVED',
    rating: 4.5,
    totalReviews: 120,
    totalTripsCompleted: 45,
    bankAccountLinked: true,
    documents: null,
    ...overrides,
  }
}

export function makeTravelerProfile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    id: 'u1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210',
    role: 'TRAVELER',
    avatarUrl: null,
    isVerified: false,
    phoneVerified: true,
    createdAt: '2025-01-15T00:00:00.000Z',
    isReseller: false,
    organizerProfile: null,
    ...overrides,
  }
}

export function makeOrganizerFullProfile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return makeTravelerProfile({
    id: 'u-org',
    name: 'Organizer User',
    role: 'ORGANIZER',
    organizerProfile: makeOrganizerProfile(),
    ...overrides,
  })
}
