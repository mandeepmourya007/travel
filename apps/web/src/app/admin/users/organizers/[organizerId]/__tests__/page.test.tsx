import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'
import type { AdminOrganizerTripsDetail } from '@shared/types/admin.types'

// Mock next/navigation (page reads the dynamic :organizerId segment via useParams)
vi.mock('next/navigation', () => ({
  useParams: () => ({ organizerId: 'org-1' }),
}))

// Mock toast — assert on calls the same way other admin/booking mutation tests do
// (see my-bookings-list.test.tsx / use-send-message.test.tsx for the pattern).
const mockToast = vi.fn()
vi.mock('@/components/shared/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Import AFTER mocks
import AdminOrganizerDetailPage from '../page'

function makeDetail(overrides: Partial<AdminOrganizerTripsDetail['organizer']> = {}): AdminOrganizerTripsDetail {
  return {
    organizer: {
      id: 'org-1',
      businessName: 'Desi Trails',
      email: 'organizer@example.com',
      phone: '9999999999',
      verificationStatus: 'APPROVED',
      tripsCount: 3,
      createdAt: '2024-01-01T00:00:00.000Z',
      commissionRate: 12,
      ...overrides,
    },
    trips: {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
  }
}

function setupHandlers(detail: AdminOrganizerTripsDetail = makeDetail()) {
  server.use(
    http.get(`${API}/admin/users/organizers/org-1`, () =>
      HttpResponse.json({ success: true, data: detail }),
    ),
  )
  return detail
}

async function openCommissionDialog(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Desi Trails')
  await user.click(screen.getByRole('button', { name: /edit/i }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  mockToast.mockClear()
})

describe('AdminOrganizerDetailPage — CommissionRateCard', () => {
  it('opens the dialog pre-filled with the organizer\'s current commission rate', async () => {
    const user = userEvent.setup()
    setupHandlers(makeDetail({ commissionRate: 12 }))
    renderWithQuery(<AdminOrganizerDetailPage />)

    expect(await screen.findByText('12%')).toBeInTheDocument()
    const dialog = await openCommissionDialog(user)

    expect(within(dialog).getByDisplayValue('12')).toBeInTheDocument()
  })

  it('rejects a value above 50 client-side without firing the mutation', async () => {
    const user = userEvent.setup()
    let patchCalled = false
    setupHandlers()
    server.use(
      http.patch(`${API}/admin/organizers/org-1/commission`, () => {
        patchCalled = true
        return HttpResponse.json({ success: true, data: { commissionRate: 60 } })
      }),
    )
    renderWithQuery(<AdminOrganizerDetailPage />)

    const dialog = await openCommissionDialog(user)
    const input = within(dialog).getByDisplayValue('12')
    await user.clear(input)
    await user.type(input, '60')

    expect(within(dialog).getByText('Must be between 0% and 50%')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /confirm/i })).toBeDisabled()

    await user.click(within(dialog).getByRole('button', { name: /confirm/i }))
    expect(patchCalled).toBe(false)
  })

  it('rejects a negative value client-side without firing the mutation', async () => {
    const user = userEvent.setup()
    let patchCalled = false
    setupHandlers()
    server.use(
      http.patch(`${API}/admin/organizers/org-1/commission`, () => {
        patchCalled = true
        return HttpResponse.json({ success: true, data: { commissionRate: -5 } })
      }),
    )
    renderWithQuery(<AdminOrganizerDetailPage />)

    const dialog = await openCommissionDialog(user)
    const input = within(dialog).getByDisplayValue('12')
    await user.clear(input)
    await user.type(input, '-5')

    expect(within(dialog).getByText('Must be between 0% and 50%')).toBeInTheDocument()
    expect(patchCalled).toBe(false)
  })

  it('disables the Confirm button while the mutation is pending', async () => {
    const user = userEvent.setup()
    setupHandlers()
    let resolvePatch: (() => void) | undefined
    server.use(
      http.patch(`${API}/admin/organizers/org-1/commission`, async () => {
        await new Promise<void>((resolve) => { resolvePatch = resolve })
        return HttpResponse.json({ success: true, data: { commissionRate: 15 } })
      }),
    )
    renderWithQuery(<AdminOrganizerDetailPage />)

    const dialog = await openCommissionDialog(user)
    const input = within(dialog).getByDisplayValue('12')
    await user.clear(input)
    await user.type(input, '15')

    const confirmButton = within(dialog).getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => expect(within(dialog).getByRole('button', { name: /saving/i })).toBeDisabled())

    resolvePatch?.()
  })

  it('closes the dialog and shows a success toast after a successful update', async () => {
    const user = userEvent.setup()
    setupHandlers()
    server.use(
      http.patch(`${API}/admin/organizers/org-1/commission`, () =>
        HttpResponse.json({ success: true, data: { commissionRate: 18 } }),
      ),
    )
    renderWithQuery(<AdminOrganizerDetailPage />)

    const dialog = await openCommissionDialog(user)
    const input = within(dialog).getByDisplayValue('12')
    await user.clear(input)
    await user.type(input, '18')
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', title: 'Commission rate updated' }),
    )
  })

  it('shows an error toast and keeps the dialog open for retry when the update fails', async () => {
    const user = userEvent.setup()
    setupHandlers()
    server.use(
      http.patch(`${API}/admin/organizers/org-1/commission`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL', message: 'Something broke' } },
          { status: 500 },
        ),
      ),
    )
    renderWithQuery(<AdminOrganizerDetailPage />)

    const dialog = await openCommissionDialog(user)
    const input = within(dialog).getByDisplayValue('12')
    await user.clear(input)
    await user.type(input, '18')
    await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', title: 'Failed to update commission rate' }),
      ),
    )
    // Dialog stays open so the admin can retry
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
