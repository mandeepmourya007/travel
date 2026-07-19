import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TripBookingCard } from '@/components/trips/trip-booking-card'
import { makeTripDetail } from '@/test/factories/trip.factory'
import { renderWithQuery } from '@/test/test-utils'

// TripBookingCard renders TripCtaButton, which calls useRouter() — not under
// test here, so stub next/navigation the same way other component tests do.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// ── Fixtures ──────────────────────────────────────────

const baseTrip = makeTripDetail({
  slug: 'test-trip',
  pricePerPerson: 5000,
  earlyBirdPrice: null,
  earlyBirdDeadline: null,
  maxGroupSize: 20,
  currentBookings: 5,
})

// ── Tests ─────────────────────────────────────────────

describe('TripBookingCard', () => {
  it('shows the plain base price when there is no reseller markup', () => {
    renderWithQuery(<TripBookingCard trip={baseTrip} />)

    expect(screen.getByText('₹5,000')).toBeInTheDocument()
  })

  // Regression guard (hard product/security requirement): a traveler viewing a
  // trip via a reseller sublink must see exactly ONE merged price — never a
  // base/markup breakdown, and never the words "markup"/"reseller fee"/
  // "extra commission" anywhere in the card.
  it('folds the reseller markup invisibly into a single merged price — no breakdown, no markup wording', () => {
    renderWithQuery(<TripBookingCard trip={baseTrip} markupAmount={500} />)

    // Single merged price: 5000 base + 500 markup = 5500.
    expect(screen.getByText('₹5,500')).toBeInTheDocument()
    // The raw base price must not appear anywhere as a second, separate figure.
    expect(screen.queryByText('₹5,000')).not.toBeInTheDocument()

    const cardText = document.body.textContent ?? ''
    expect(cardText.toLowerCase()).not.toMatch(/markup|reseller fee|extra commission/)
  })

  it('merges the markup into the early-bird price (not the struck-through regular price) when early-bird is active', () => {
    const earlyBirdTrip = makeTripDetail({
      slug: 'test-trip',
      pricePerPerson: 6000,
      earlyBirdPrice: 5000,
      earlyBirdDeadline: new Date(Date.now() + 86400000).toISOString(),
      maxGroupSize: 20,
      currentBookings: 5,
    })

    renderWithQuery(<TripBookingCard trip={earlyBirdTrip} markupAmount={300} />)

    // Merged early-bird + markup: 5000 + 300 = 5300.
    expect(screen.getByText('₹5,300')).toBeInTheDocument()
    // The struck-through regular price is unaffected by markup (it's a reference price, not charged).
    expect(screen.getByText('₹6,000')).toBeInTheDocument()

    const cardText = document.body.textContent ?? ''
    expect(cardText.toLowerCase()).not.toMatch(/markup|reseller fee|extra commission/)
  })
})
