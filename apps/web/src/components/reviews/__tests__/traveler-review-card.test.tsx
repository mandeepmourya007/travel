import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TravelerReviewCard } from '../traveler-review-card'
import { makeReview } from '@/test/factories/review.factory'
import { REVIEW_EDIT_WINDOW_DAYS } from '@shared/constants/review'

// Isolate ReviewFormModal — we test TravelerReviewCard behaviour, not the modal internals
vi.mock('@/components/bookings/review-form-modal', () => ({
  ReviewFormModal: () => <div data-testid="review-form-modal" />,
}))

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

describe('TravelerReviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Edit window logic ────────────────────────────

  it('shows Edit button when review is within the edit window', () => {
    const review = makeReview({ createdAt: daysAgo(1) })
    render(<TravelerReviewCard review={review} />)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows Edit button one day before the boundary', () => {
    const review = makeReview({ createdAt: daysAgo(REVIEW_EDIT_WINDOW_DAYS - 1) })
    render(<TravelerReviewCard review={review} />)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('hides Edit button when review is past the edit window', () => {
    const review = makeReview({ createdAt: daysAgo(REVIEW_EDIT_WINDOW_DAYS + 1) })
    render(<TravelerReviewCard review={review} />)
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  // ─── Content rendering ────────────────────────────

  it('renders trip title when trip is present', () => {
    const review = makeReview({ trip: { title: 'Spiti Valley', slug: 'spiti-valley' } })
    render(<TravelerReviewCard review={review} />)
    expect(screen.getByText('Spiti Valley')).toBeInTheDocument()
  })

  it('renders comment when present', () => {
    const review = makeReview({ comment: 'Amazing experience in the mountains!' })
    render(<TravelerReviewCard review={review} />)
    expect(screen.getByText('Amazing experience in the mountains!')).toBeInTheDocument()
  })

  it('does not render comment section when comment is null', () => {
    const review = makeReview({ comment: null })
    render(<TravelerReviewCard review={review} />)
    expect(screen.queryByText(/comment/i)).not.toBeInTheDocument()
  })

  it('shows Edited badge when editedAt is set', () => {
    const review = makeReview({ editedAt: daysAgo(2), createdAt: daysAgo(5) })
    render(<TravelerReviewCard review={review} />)
    expect(screen.getByText('Edited')).toBeInTheDocument()
  })

  it('does not show Edited badge when editedAt is null', () => {
    const review = makeReview({ editedAt: null })
    render(<TravelerReviewCard review={review} />)
    expect(screen.queryByText('Edited')).not.toBeInTheDocument()
  })

  // ─── Organizer reply ──────────────────────────────

  it('renders organizer reply when present', () => {
    const review = makeReview({ organizerReply: 'Thank you for the kind words!' })
    render(<TravelerReviewCard review={review} />)
    expect(screen.getByText('Organizer replied')).toBeInTheDocument()
    expect(screen.getByText('Thank you for the kind words!')).toBeInTheDocument()
  })

  it('does not render organizer reply section when reply is null', () => {
    const review = makeReview({ organizerReply: null })
    render(<TravelerReviewCard review={review} />)
    expect(screen.queryByText('Organizer replied')).not.toBeInTheDocument()
  })
})
