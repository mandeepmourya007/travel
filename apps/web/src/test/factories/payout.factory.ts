import type { AdminPendingPayoutItem, ReleasePayoutResult } from '@shared/types/admin.types'

let counter = 0

export function resetPayoutFactory() {
  counter = 0
}

export function makePendingPayoutItem(overrides: Partial<AdminPendingPayoutItem> = {}): AdminPendingPayoutItem {
  counter++
  return {
    organizerId: `org_${counter}`,
    businessName: `Himalayan Trails ${counter}`,
    userId: `user_${counter}`,
    userName: `Organizer ${counter}`,
    email: `organizer${counter}@example.com`,
    balance: 5000,
    currency: 'INR',
    hasFundAccount: true,
    hasUnreconciledPayout: false,
    ...overrides,
  }
}

export function makeReleasePayoutResult(overrides: Partial<ReleasePayoutResult> = {}): ReleasePayoutResult {
  return {
    status: 'released',
    releasedAmount: 5000,
    payoutId: 'payout_1',
    ...overrides,
  }
}
