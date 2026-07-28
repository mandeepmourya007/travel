import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PendingPayoutsTable } from '../pending-payouts-table'
import { makePendingPayoutItem, resetPayoutFactory } from '@/test/factories/payout.factory'

describe('PendingPayoutsTable', () => {
  beforeEach(() => {
    resetPayoutFactory()
    vi.clearAllMocks()
  })

  const noop = () => {}

  it('renders the warning badge (desktop + mobile) when hasUnreconciledPayout is true', () => {
    const org = makePendingPayoutItem({ hasUnreconciledPayout: true })
    render(
      <PendingPayoutsTable
        data={[org]}
        isLoading={false}
        error={null}
        onSendPayout={noop}
        page={1}
        onPageChange={noop}
      />,
    )

    // Desktop badge text and mobile badge text differ — assert both exist since
    // the responsive dual-render means both are in the DOM simultaneously.
    expect(screen.getByText('Unreconciled payout')).toBeInTheDocument()
    expect(screen.getByText('Unreconciled payout — verify before sending')).toBeInTheDocument()
  })

  it('disables the Send Payout button when hasUnreconciledPayout is true, even if hasFundAccount is also true', () => {
    const org = makePendingPayoutItem({ hasFundAccount: true, hasUnreconciledPayout: true })
    render(
      <PendingPayoutsTable
        data={[org]}
        isLoading={false}
        error={null}
        onSendPayout={noop}
        page={1}
        onPageChange={noop}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /send payout/i })
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute(
        'title',
        expect.stringContaining('Unreconciled payout'),
      )
    })
  })

  it('disables the Send Payout button when hasFundAccount is false', () => {
    const org = makePendingPayoutItem({ hasFundAccount: false, hasUnreconciledPayout: false })
    render(
      <PendingPayoutsTable
        data={[org]}
        isLoading={false}
        error={null}
        onSendPayout={noop}
        page={1}
        onPageChange={noop}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /send payout/i })
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('title', 'No RazorpayX fund account on file')
    })
  })

  it('enables the Send Payout button and shows no warning badge in the clean happy-path case', () => {
    const org = makePendingPayoutItem({ hasFundAccount: true, hasUnreconciledPayout: false, balance: 5000 })
    render(
      <PendingPayoutsTable
        data={[org]}
        isLoading={false}
        error={null}
        onSendPayout={noop}
        page={1}
        onPageChange={noop}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /send payout/i })
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled()
    })
    expect(screen.queryByText('Unreconciled payout')).not.toBeInTheDocument()
    expect(screen.queryByText('Unreconciled payout — verify before sending')).not.toBeInTheDocument()
  })

  it('renders the EmptyState with the zero-pending-balance message when data is empty', () => {
    render(
      <PendingPayoutsTable
        data={[]}
        isLoading={false}
        error={null}
        onSendPayout={noop}
        page={1}
        onPageChange={noop}
      />,
    )

    expect(
      screen.getByText("No pending payouts — every organizer's wallet balance is at zero."),
    ).toBeInTheDocument()
  })

  it('does not render a Send Payout button when the organizer balance is zero', () => {
    const org = makePendingPayoutItem({ balance: 0 })
    render(
      <PendingPayoutsTable
        data={[org]}
        isLoading={false}
        error={null}
        onSendPayout={noop}
        page={1}
        onPageChange={noop}
      />,
    )

    expect(screen.queryByRole('button', { name: /send payout/i })).not.toBeInTheDocument()
  })
})
