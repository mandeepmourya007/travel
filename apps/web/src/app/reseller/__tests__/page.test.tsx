import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { renderWithQuery } from '@/test/test-utils'
import { API_BASE_URL as API } from '@/test/test-constants'
import { makeTravelerProfile } from '@/test/factories/profile.factory'
import { makeMainLinkWithEarnings, makeSublink, resetResellerFactory } from '@/test/factories/reseller.factory'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// AuthGuard reads isAuthenticated/_hasHydrated/user.role from the Zustand store directly.
const { mockAuthState } = vi.hoisted(() => {
  const mockAuthState = () => ({
    user: { id: 'traveler-1', name: 'Traveler User', role: 'TRAVELER', phoneVerified: true },
    accessToken: 'test-jwt',
    isAuthenticated: true,
    _hasHydrated: true,
  })
  return { mockAuthState }
})
vi.mock('@/store/auth.store', () => {
  const store = (selector: (state: Record<string, unknown>) => unknown) => selector(mockAuthState())
  store.getState = mockAuthState
  return { useAuthStore: store }
})

import ResellerHomePage from '../page'

function mockProfile(isReseller: boolean) {
  server.use(
    http.get(`${API}/auth/profile`, () =>
      HttpResponse.json({ success: true, data: makeTravelerProfile({ isReseller }) }),
    ),
  )
}

function mockMyMainLinks(data: ReturnType<typeof makeMainLinkWithEarnings>[]) {
  server.use(
    http.get(`${API}/reseller/main-links/mine`, () =>
      HttpResponse.json({ success: true, data, pagination: { page: 1, limit: 10, total: data.length } }),
    ),
  )
}

function mockMySublinks(data: ReturnType<typeof makeSublink>[]) {
  server.use(
    http.get(`${API}/reseller/sublinks`, () =>
      HttpResponse.json({ success: true, data, pagination: { page: 1, limit: 10, total: data.length } }),
    ),
  )
}

beforeEach(() => {
  resetResellerFactory()
})

describe('ResellerHomePage — isReseller gating', () => {
  it('shows an EmptyState / access-denied message when the traveler is not a reseller', async () => {
    mockProfile(false)

    renderWithQuery(<ResellerHomePage />)

    expect(await screen.findByText(/not registered as a reseller/i)).toBeInTheDocument()
    expect(screen.queryByText(/reseller links/i)).not.toBeInTheDocument()
  })
})

describe('ResellerHomePage — trip cards', () => {
  it('renders one card per shared trip with organizer, link/booking counts, and earnings', async () => {
    mockProfile(true)
    mockMyMainLinks([
      makeMainLinkWithEarnings({
        tripTitle: 'Goa Beach Getaway',
        organizerName: 'Wanderlust Travels',
        sublinkCount: 2,
        bookingCount: 3,
        totalMarkupAmount: 1500,
      }),
    ])

    renderWithQuery(<ResellerHomePage />)

    expect(await screen.findByText('Goa Beach Getaway')).toBeInTheDocument()
    expect(screen.getByText('Wanderlust Travels')).toBeInTheDocument()
    expect(screen.getByText('2 links')).toBeInTheDocument()
    expect(screen.getByText('3 bookings')).toBeInTheDocument()
    expect(screen.getAllByText('₹1,500').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /view links/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate link/i })).toBeInTheDocument()
  })

  it('shows an empty state when no trips have been shared with the reseller', async () => {
    mockProfile(true)
    mockMyMainLinks([])

    renderWithQuery(<ResellerHomePage />)

    expect(await screen.findByText(/no trips have been shared with you yet/i)).toBeInTheDocument()
  })
})

describe('ResellerHomePage — generate link modal (card trigger)', () => {
  it('opens the simplified generate-link modal (no trip picker) and creates a sublink', async () => {
    mockProfile(true)
    mockMyMainLinks([makeMainLinkWithEarnings({ id: 'link-1', token: 'main-tok-1', tripTitle: 'Goa Beach Getaway' })])
    const sublink = makeSublink({ tripSlug: 'goa-beach-getaway', token: 'sub-tok-99' })
    server.use(
      http.post(`${API}/reseller/sublinks`, () => HttpResponse.json({ success: true, data: sublink })),
    )

    const user = userEvent.setup()
    renderWithQuery(<ResellerHomePage />)

    const generateButton = await screen.findByRole('button', { name: /generate link/i })
    await user.click(generateButton)

    // No trip picker (SearchCombobox) in this simplified flow.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/extra amount per traveler/i), '500')

    const modalGenerateButton = screen.getAllByRole('button', { name: /generate link/i }).find((b) => b !== generateButton)
    await user.click(modalGenerateButton!)

    await waitFor(() => {
      expect(screen.getByText(/share this url with travelers/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/goa-beach-getaway\?ref=sub-tok-99/)).toBeInTheDocument()
  })
})

describe('ResellerHomePage — sublinks drill-in (View Links)', () => {
  it('opens the drill-in with the trip\'s sublinks, and its own Generate Link + edit-rate + view flows work', async () => {
    mockProfile(true)
    mockMyMainLinks([makeMainLinkWithEarnings({ id: 'link-1', token: 'main-tok-1', tripTitle: 'Goa Beach Getaway' })])
    mockMySublinks([
      makeSublink({ id: 'sub-1', label: 'Instagram', markupAmount: 600, bookingCount: 2, totalMarkupAmount: 1800, tripSlug: 'goa-beach-getaway', token: 'sub-tok-1' }),
    ])
    server.use(
      http.get(`${API}/reseller/sublinks/sub-1/bookings`, () =>
        HttpResponse.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0 } }),
      ),
      http.patch(`${API}/reseller/sublinks/sub-1`, () => HttpResponse.json({ success: true })),
    )

    const user = userEvent.setup()
    renderWithQuery(<ResellerHomePage />)

    await user.click(await screen.findByRole('button', { name: /view links/i }))

    const drilldownDialog = await screen.findByRole('dialog', { name: 'Links for "Goa Beach Getaway"' })
    expect(within(drilldownDialog).getByText('Instagram')).toBeInTheDocument()
    expect(within(drilldownDialog).getByText('₹600/person')).toBeInTheDocument()

    // Views drill-down for a specific sublink row
    await user.click(within(drilldownDialog).getByRole('button', { name: /view/i }))
    expect(await screen.findByText(/bookings via this sublink/i)).toBeInTheDocument()
    expect(await screen.findByText(/no bookings via this link yet/i)).toBeInTheDocument()

    // Edit-rate modal — opened from the drilldown's own row (still mounted
    // behind the bookings modal; the underlying click still fires in jsdom)
    await user.click(within(drilldownDialog).getByLabelText('Edit markup rate'))
    const editDialog = await screen.findByRole('dialog', { name: 'Edit Markup Rate' })
    const rateInput = within(editDialog).getByLabelText(/rate per traveler/i)
    await user.clear(rateInput)
    await user.type(rateInput, '700')
    await user.click(within(editDialog).getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Markup Rate' })).not.toBeInTheDocument()
    })

    // Drill-in's own "+ Generate Link" opens the same simplified modal
    await user.click(within(drilldownDialog).getByRole('button', { name: /generate link/i }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/extra amount per traveler/i)).toBeInTheDocument()
  })
})
