import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { makeLeadRow, resetResellerFactory } from '@/test/factories/reseller.factory'
import { ResellerLeadsTable } from '../reseller-leads-table'

beforeEach(() => {
  resetResellerFactory()
})

const noop = () => {}

describe('ResellerLeadsTable', () => {
  it('renders the read-only columns: Trip Name, Booking Count, Earnings, Link, Views', async () => {
    const lead = makeLeadRow({ sublinkId: 'sub-1', markupAmount: 500, bookingCount: 3, totalMarkupAmount: 1500 })
    renderWithQuery(
      <ResellerLeadsTable
        leads={[lead]}
        isLoading={false}
        error={null}
        onViewBookings={noop}
      />,
    )

    expect(await screen.findByText(lead.tripTitle)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Booking Count')).toBeInTheDocument()
    expect(screen.getByText('Earnings')).toBeInTheDocument()
    expect(screen.getByText('Link')).toBeInTheDocument()
    expect(screen.getByText('Views')).toBeInTheDocument()
    // Rate/edit-markup affordance no longer exists on this table.
    expect(screen.queryByText('Rate')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/edit markup rate/i)).not.toBeInTheDocument()
  })

  it('renders the identity column when identityColumn is provided', async () => {
    const lead = makeLeadRow({ sublinkId: 'sub-2', resellerName: 'Jane Reseller' })
    renderWithQuery(
      <ResellerLeadsTable
        leads={[lead]}
        identityColumn="reseller"
        isLoading={false}
        error={null}
        onViewBookings={noop}
      />,
    )

    expect(await screen.findByText('Reseller')).toBeInTheDocument()
    expect(screen.getByText('Jane Reseller')).toBeInTheDocument()
  })

  it('copies the sublink URL when the Copy button is clicked', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const lead = makeLeadRow({ sublinkId: 'sub-3' })
    renderWithQuery(
      <ResellerLeadsTable
        leads={[lead]}
        isLoading={false}
        error={null}
        onViewBookings={noop}
      />,
    )

    await user.click(await screen.findByRole('button', { name: /copy/i }))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalled()
  })

  it('invokes onViewBookings when the View button is clicked', async () => {
    const lead = makeLeadRow({ sublinkId: 'sub-4' })
    const onViewBookings = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(
      <ResellerLeadsTable
        leads={[lead]}
        isLoading={false}
        error={null}
        onViewBookings={onViewBookings}
      />,
    )

    await user.click(await screen.findByRole('button', { name: /view/i }))
    expect(onViewBookings).toHaveBeenCalledWith('sub-4')
  })

  it('renders pagination controls when there is more than one page', async () => {
    const lead = makeLeadRow({ sublinkId: 'sub-5' })
    const onPageChange = vi.fn()
    renderWithQuery(
      <ResellerLeadsTable
        leads={[lead]}
        isLoading={false}
        error={null}
        onViewBookings={noop}
        pagination={{ page: 1, limit: 10, total: 25 }}
        onPageChange={onPageChange}
      />,
    )

    expect(await screen.findByText(lead.tripTitle)).toBeInTheDocument()
    expect(screen.getByText(/25/)).toBeInTheDocument()
  })
})
