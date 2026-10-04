import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TripFilters } from '../trip-filters'
import { useSearchStore } from '@/store/search.store'
import type { TripFilters as TripFiltersType } from '@shared/types/trip.types'

const { mockParams, mockRouter } = vi.hoisted(() => ({
  mockParams: { value: '' },
  // Stable identity, like the real router — effects depend on it
  mockRouter: { push: vi.fn() },
}))
const mockPush = mockRouter.push

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/trips',
  useSearchParams: () => new URLSearchParams(mockParams.value),
}))
vi.mock('@tanstack/react-query', () => ({ useIsFetching: () => 0 }))
vi.mock('@/hooks/use-destinations', () => ({
  useDestinations: () => ({ data: [{ id: 'x', name: 'Goa' }, { id: 'y', name: 'Manali' }] }),
}))
vi.mock('@/hooks/use-trip-categories', () => ({
  useTripCategories: () => ({ data: [{ value: 'ADVENTURE', label: 'Adventure' }] }),
}))
vi.mock('@/components/shared/price-range-slider', () => ({ PriceRangeSlider: () => null }))

/** Parse URL params into the same shape `trips-page-client` derives. */
function filtersFrom(query: string): TripFiltersType {
  const p = new URLSearchParams(query)
  return {
    q: p.get('q') || undefined,
    destinationId: p.get('destinationId') || undefined,
    tripType: p.get('tripType') || undefined,
    minPrice: p.get('minPrice') ? Number(p.get('minPrice')) : undefined,
    maxPrice: p.get('maxPrice') ? Number(p.get('maxPrice')) : undefined,
    sort: (p.get('sort') as TripFiltersType['sort']) || 'newest',
  }
}

function renderAt(query = '') {
  mockParams.value = query
  const utils = render(<TripFilters currentFilters={filtersFrom(query)} />)
  const navigate = (next: string) => {
    mockParams.value = next
    utils.rerender(<TripFilters currentFilters={filtersFrom(next)} />)
  }
  return { ...utils, navigate }
}

// Desktop form is always rendered (mobile drawer only when opened) — use the first match.
const searchInput = () => screen.getAllByLabelText('Search')[0] as HTMLInputElement
const destinationSelect = () => screen.getAllByLabelText('Destination')[0] as HTMLSelectElement
const applyButton = () => screen.getAllByRole('button', { name: 'Apply Filters' })[0] as HTMLButtonElement
const clearButton = () => screen.queryAllByRole('button', { name: 'Clear Filters' })[0]

describe('TripFilters (apply-only)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPush.mockClear()
    useSearchStore.getState().reset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('staged changes do not push to the URL', () => {
    renderAt()
    fireEvent.change(searchInput(), { target: { value: 'goa' } })
    fireEvent.change(destinationSelect(), { target: { value: 'x' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Adventure' })[0])
    fireEvent.change(document.getElementById('filter-min-price')!, { target: { value: '1000' } })
    act(() => vi.advanceTimersByTime(2000))
    expect(mockPush).not.toHaveBeenCalled()
    expect(applyButton().disabled).toBe(false)
  })

  it('Apply is disabled when staged values equal the URL', () => {
    renderAt('q=goa&destinationId=x')
    expect(applyButton().disabled).toBe(true)
    // Trailing whitespace alone is not a change
    fireEvent.change(searchInput(), { target: { value: 'goa ' } })
    expect(applyButton().disabled).toBe(true)
  })

  it('Apply pushes once with all staged values and drops page', () => {
    renderAt('page=3')
    fireEvent.change(searchInput(), { target: { value: ' goa ' } })
    fireEvent.change(destinationSelect(), { target: { value: 'x' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Adventure' })[0])
    fireEvent.change(screen.getAllByLabelText('Sort By')[0], { target: { value: 'price_asc' } })
    fireEvent.click(applyButton())

    expect(mockPush).toHaveBeenCalledTimes(1)
    const [url, opts] = mockPush.mock.calls[0]
    expect(opts).toEqual({ scroll: false })
    const params = new URLSearchParams(String(url).split('?')[1])
    expect(Object.fromEntries(params)).toEqual({
      q: 'goa',
      destinationId: 'x',
      tripType: 'ADVENTURE',
      sort: 'price_asc',
    })
  })

  it('Enter in the search input applies', () => {
    renderAt()
    const input = searchInput()
    fireEvent.change(input, { target: { value: 'kasol' } })
    fireEvent.submit(input.closest('form')!)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/trips?q=kasol', { scroll: false })
  })

  it('the echo of our own push does not overwrite newer edits', () => {
    const { navigate } = renderAt()
    fireEvent.change(searchInput(), { target: { value: 'goa ' } })
    fireEvent.click(applyButton())
    // User keeps editing before the URL update lands
    fireEvent.change(searchInput(), { target: { value: 'goa beach' } })
    navigate('q=goa')
    expect(searchInput().value).toBe('goa beach')
  })

  it('external URL change re-seeds all staged values', () => {
    const { navigate } = renderAt('q=goa&destinationId=x')
    fireEvent.change(destinationSelect(), { target: { value: 'y' } })
    navigate('q=rishikesh')
    expect(searchInput().value).toBe('rishikesh')
    expect(destinationSelect().value).toBe('')
    expect(useSearchStore.getState().query).toBe('rishikesh')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('fresh load with ?q= shows the text in both bars (shared store)', () => {
    renderAt('q=goa')
    expect(searchInput().value).toBe('goa')
    expect(useSearchStore.getState().query).toBe('goa')
  })

  it('header typing mirrors into the filter but pushes nothing', () => {
    renderAt('q=goa')
    act(() => useSearchStore.getState().setQuery('manali'))
    expect(searchInput().value).toBe('manali')
    act(() => vi.advanceTimersByTime(1000))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('filter typing updates the shared query (header shows it too)', () => {
    renderAt()
    fireEvent.change(searchInput(), { target: { value: 'kasol' } })
    expect(useSearchStore.getState().query).toBe('kasol')
  })

  describe('Clear Filters', () => {
    it('is hidden when no filters are applied or staged', () => {
      renderAt()
      expect(clearButton()).toBeUndefined()
    })

    it('is visible when URL filters are applied', () => {
      renderAt('destinationId=x')
      expect(clearButton()).toBeDefined()
    })

    it('is visible for staged-only changes and resets them without pushing', () => {
      renderAt()
      fireEvent.change(destinationSelect(), { target: { value: 'x' } })
      fireEvent.click(clearButton()!)
      expect(destinationSelect().value).toBe('')
      expect(mockPush).not.toHaveBeenCalled()
      expect(clearButton()).toBeUndefined()
    })

    it('pushes the bare pathname and empties both search bars', () => {
      renderAt('q=goa&destinationId=x')
      fireEvent.click(clearButton()!)
      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/trips', { scroll: false })
      expect(useSearchStore.getState().query).toBe('')
      expect(searchInput().value).toBe('')
      expect(destinationSelect().value).toBe('')
    })
  })
})
