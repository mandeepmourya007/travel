import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ResellerSearchCombobox, OrganizerSearchCombobox } from '@/components/shared/reseller-search-combobox'
import { renderWithQuery } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'
import { makeResellerSearchResult, makeOrganizerSearchResult, resetResellerFactory } from '@/test/factories/reseller.factory'

describe('ResellerSearchCombobox', () => {
  it('renders the "All Resellers" trigger closed by default', () => {
    renderWithQuery(<ResellerSearchCombobox value={undefined} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveTextContent('All Resellers')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opening the trigger fires the search query, and typing re-fires it with the debounced term', async () => {
    resetResellerFactory()
    const capturedQueries: (string | null)[] = []
    server.use(
      http.get(`${API}/reseller/resellers/search`, ({ request }) => {
        capturedQueries.push(new URL(request.url).searchParams.get('q'))
        return HttpResponse.json({
          success: true,
          data: [makeResellerSearchResult({ id: 'r1', name: 'Resale Rani', email: 'rani@x.com' })],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        })
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<ResellerSearchCombobox value={undefined} onChange={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Resale Rani')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search resellers…'), 'rani')

    await waitFor(() => expect(capturedQueries).toContain('rani'), { timeout: 2000 })
  })

  it('selecting an option calls onChange with its id and closes the dropdown', async () => {
    server.use(
      http.get(`${API}/reseller/resellers/search`, () =>
        HttpResponse.json({
          success: true,
          data: [makeResellerSearchResult({ id: 'r1', name: 'Resale Rani', email: 'rani@x.com' })],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    )

    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithQuery(<ResellerSearchCombobox value={undefined} onChange={onChange} />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Resale Rani')).toBeInTheDocument())
    await user.click(screen.getByText('Resale Rani'))

    expect(onChange).toHaveBeenCalledWith('r1')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('scrolling near the bottom of the listbox loads and appends the next page', async () => {
    resetResellerFactory()
    const seenPages: (string | null)[] = []
    server.use(
      http.get(`${API}/reseller/resellers/search`, ({ request }) => {
        const pageParam = new URL(request.url).searchParams.get('page')
        seenPages.push(pageParam)
        const page = Number(pageParam ?? '1')
        const item =
          page === 1
            ? makeResellerSearchResult({ id: 'r1', name: 'Resale Rani' })
            : makeResellerSearchResult({ id: 'r2', name: 'Bargain Bhai' })
        return HttpResponse.json({
          success: true,
          data: [item],
          pagination: { page, limit: 10, total: 2, totalPages: 2 },
        })
      }),
    )

    const user = userEvent.setup()
    renderWithQuery(<ResellerSearchCombobox value={undefined} onChange={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Resale Rani')).toBeInTheDocument())

    const listbox = screen.getByRole('listbox')
    Object.defineProperty(listbox, 'scrollTop', { value: 200, configurable: true })
    Object.defineProperty(listbox, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(listbox, 'scrollHeight', { value: 250, configurable: true })
    fireEvent.scroll(listbox)

    await waitFor(() => expect(screen.getByText('Bargain Bhai')).toBeInTheDocument())
    // page 1 result is still present — appended, not replaced
    expect(screen.getByText('Resale Rani')).toBeInTheDocument()
    expect(seenPages).toEqual(['1', '2'])
  })
})

describe('OrganizerSearchCombobox', () => {
  it('renders the "All Organizers" trigger and lists results by businessName', async () => {
    server.use(
      http.get(`${API}/reseller/organizers/search`, () =>
        HttpResponse.json({
          success: true,
          data: [makeOrganizerSearchResult({ id: 'o1', businessName: 'Trek India Adventures', email: 'trek@x.com' })],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithQuery(<OrganizerSearchCombobox value={undefined} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveTextContent('All Organizers')

    await user.click(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText('Trek India Adventures')).toBeInTheDocument())
  })
})
