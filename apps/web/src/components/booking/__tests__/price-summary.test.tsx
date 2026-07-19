import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PriceSummary } from '@/components/booking/price-summary'
import { makeTripDetail } from '@/test/factories/trip.factory'
import type { TransferPoint } from '@shared/types/trip.types'

// ── Fixtures ──────────────────────────────────────────

const baseTrip = makeTripDetail({
  slug: 'test-trip',
  pricePerPerson: 5000,
  earlyBirdPrice: null,
  earlyBirdDeadline: null,
})

const pickupWithCharge: TransferPoint = {
  id: 'pickup-1',
  type: 'PICKUP',
  label: 'Mumbai Dadar',
  time: '07:00 AM',
  extraCharge: 400,
  sortOrder: 0,
  address: null,
}

const pickupFree: TransferPoint = {
  id: 'pickup-2',
  type: 'PICKUP',
  label: 'Kashmere Gate',
  time: '08:00 AM',
  extraCharge: 0,
  sortOrder: 1,
  address: null,
}

const dropWithCharge: TransferPoint = {
  id: 'drop-1',
  type: 'DROP',
  label: 'Pune Station',
  time: '06:00 PM',
  extraCharge: 300,
  sortOrder: 0,
  address: null,
}

// ── Tests ─────────────────────────────────────────────

describe('PriceSummary', () => {

  // ── 1. Base price row ──

  it('should show base price row with per-person rate and traveler count', () => {
    render(<PriceSummary trip={baseTrip} numTravelers={2} />)

    expect(screen.getByText(/base price/i)).toBeInTheDocument()
    // base row label contains "₹5,000 × 2"
    expect(screen.getByText(/₹5,000 × 2/)).toBeInTheDocument()
    // grand total label is rendered once
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('should update base total when numTravelers changes', () => {
    const { rerender } = render(<PriceSummary trip={baseTrip} numTravelers={1} />)
    // base row shows "₹5,000 × 1"
    expect(screen.getByText(/₹5,000 × 1/)).toBeInTheDocument()

    rerender(<PriceSummary trip={baseTrip} numTravelers={3} />)
    expect(screen.getByText(/₹5,000 × 3/)).toBeInTheDocument()
  })

  // ── 2. Pickup surcharge row ──

  it('should show pickup surcharge row when extraCharge > 0', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={2}
        selectedPickupPoint={pickupWithCharge}
      />,
    )

    expect(screen.getByText(/pickup:/i)).toBeInTheDocument()
    expect(screen.getByText(/mumbai dadar/i)).toBeInTheDocument()
    // ₹400/person label
    expect(screen.getByText(/₹400\/person/i)).toBeInTheDocument()
    // +₹800 total (400 × 2 travelers)
    expect(screen.getByText('+₹800')).toBeInTheDocument()
  })

  it('should NOT show pickup surcharge row when extraCharge is 0', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={2}
        selectedPickupPoint={pickupFree}
      />,
    )

    expect(screen.queryByText(/pickup:/i)).not.toBeInTheDocument()
  })

  it('should NOT show pickup surcharge row when no pickup point is passed', () => {
    render(<PriceSummary trip={baseTrip} numTravelers={2} />)

    expect(screen.queryByText(/pickup:/i)).not.toBeInTheDocument()
  })

  // ── 3. Drop surcharge row ──

  it('should show drop surcharge row when extraCharge > 0', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={2}
        selectedDropPoint={dropWithCharge}
      />,
    )

    expect(screen.getByText(/drop:/i)).toBeInTheDocument()
    expect(screen.getByText(/pune station/i)).toBeInTheDocument()
    expect(screen.getByText(/₹300\/person/i)).toBeInTheDocument()
    // +₹600 total (300 × 2)
    expect(screen.getByText('+₹600')).toBeInTheDocument()
  })

  it('should NOT show drop surcharge row when no drop point is passed', () => {
    render(<PriceSummary trip={baseTrip} numTravelers={2} />)

    expect(screen.queryByText(/drop:/i)).not.toBeInTheDocument()
  })

  // ── 4. Total calculation ──

  it('should show total as base + pickup surcharge + drop surcharge', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={2}
        selectedPickupPoint={pickupWithCharge}
        selectedDropPoint={dropWithCharge}
      />,
    )

    // base: 5000×2 = 10000, pickup: 400×2 = 800, drop: 300×2 = 600 → total: 11400
    expect(screen.getByText('₹11,400')).toBeInTheDocument()
  })

  it('should show total as base only when both transfer points have zero charge', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={2}
        selectedPickupPoint={pickupFree}
      />,
    )

    // No surcharge rows
    expect(screen.queryByText(/pickup:/i)).not.toBeInTheDocument()
    // 5000 × 2 = 10000 — check via total row container
    const totalRow = screen.getByText('Total').closest('div')
    expect(totalRow?.textContent).toContain('₹10,000')
  })

  it('should multiply surcharges by numTravelers correctly', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={3}
        selectedPickupPoint={pickupWithCharge}
      />,
    )

    // pickup: 400 × 3 = 1200
    expect(screen.getByText('+₹1,200')).toBeInTheDocument()
    // total: 5000×3 + 400×3 = 15000 + 1200 = 16200
    expect(screen.getByText('₹16,200')).toBeInTheDocument()
  })

  // ── 5. Early bird pricing ──

  it('should show early bird label when early bird price is active', () => {
    const earlyBirdTrip = makeTripDetail({
      slug: 'test-trip',
      pricePerPerson: 6000,
      earlyBirdPrice: 5000,
      earlyBirdDeadline: new Date(Date.now() + 86400000).toISOString(),
    })

    render(<PriceSummary trip={earlyBirdTrip} numTravelers={1} />)

    expect(screen.getByText(/early bird/i)).toBeInTheDocument()
  })

  // ── 6. R1 regression — no stale assertions ──

  it('should show time next to label when transfer point has time', () => {
    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={1}
        selectedPickupPoint={pickupWithCharge}
      />,
    )

    // "Mumbai Dadar · 07:00 AM" should appear in the pickup row
    expect(screen.getByText(/07:00 AM/)).toBeInTheDocument()
  })

  it('should omit time separator when transfer point has no time', () => {
    const noTimePoint: TransferPoint = { ...pickupWithCharge, time: null }

    render(
      <PriceSummary
        trip={baseTrip}
        numTravelers={1}
        selectedPickupPoint={noTimePoint}
      />,
    )

    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  // ── 7. Reseller markup — must never leak as a separate line item ──
  // Hard product/security requirement: a traveler booking via a reseller
  // sublink pays base+markup, but must only ever see ONE merged per-person
  // price and ONE merged total — never a "markup"/"reseller fee" row, and
  // never two separate price figures for the same trip.

  it('folds markupAmount invisibly into the base price row — no separate markup line item', () => {
    render(<PriceSummary trip={baseTrip} numTravelers={2} markupAmount={500} />)

    // Merged per-person price: 5000 + 500 = 5500, shown once in the base row.
    expect(screen.getByText(/₹5,500 × 2/)).toBeInTheDocument()
    // The raw, un-marked-up price must not appear anywhere as a second figure.
    expect(screen.queryByText(/₹5,000 × 2/)).not.toBeInTheDocument()

    const pageText = document.body.textContent ?? ''
    expect(pageText.toLowerCase()).not.toMatch(/markup|reseller fee|extra commission/)
  })

  it('rolls the markup into the grand Total — total reflects base+markup, not base alone', () => {
    render(<PriceSummary trip={baseTrip} numTravelers={2} markupAmount={500} />)

    // Total: (5000+500) × 2 = 11000 — not the base-only 10000.
    const totalRow = screen.getByText('Total').closest('div')
    expect(totalRow?.textContent).toContain('₹11,000')
    expect(totalRow?.textContent).not.toContain('₹10,000')
  })

  it('is byte-identical to the non-reseller total when markupAmount is 0 (regression)', () => {
    render(<PriceSummary trip={baseTrip} numTravelers={2} markupAmount={0} />)

    const totalRow = screen.getByText('Total').closest('div')
    expect(totalRow?.textContent).toContain('₹10,000')
  })
})
