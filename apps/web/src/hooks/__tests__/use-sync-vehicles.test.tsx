import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'
import type { CreateVehicleDto, OrganizerVehicleListItem } from '@shared/types/vehicle.types'
import type { SeatCellTypeConst } from '@shared/constants/vehicle'

// ── Mocks ────────────────────────────────────────────

const mockToast = vi.fn()
vi.mock('@/components/shared/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Import AFTER mocks
import { useSyncVehicles } from '../use-sync-vehicles'

// ── Fixtures ─────────────────────────────────────────

const TRIP_ID = 'trip-1'

const baseLayout: SeatCellTypeConst[][] = [['SEAT', 'SEAT']]
const baseLayoutConfig = { rows: 1, cols: 2, aisleAfterCol: null, driverPos: [0, 1] as [number, number] }

function existingVehicle(overrides: Partial<OrganizerVehicleListItem> = {}): OrganizerVehicleListItem {
  return {
    id: 'veh-1',
    label: 'Innova',
    vehicleType: 'innova',
    sortOrder: 0,
    layoutConfig: baseLayoutConfig,
    layout: baseLayout,
    photos: ['https://res.cloudinary.com/demo/old-1.jpg'],
    seatCount: 2,
    ...overrides,
  }
}

function incomingVehicle(overrides: Partial<CreateVehicleDto> = {}): CreateVehicleDto {
  return {
    label: 'Innova',
    vehicleType: 'innova',
    layoutConfig: baseLayoutConfig,
    layout: baseLayout,
    photos: ['https://res.cloudinary.com/demo/old-1.jpg'],
    ...overrides,
  }
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

/** Tracks vehicle create (POST) and delete (DELETE) calls hitting the sync endpoints. */
function trackVehicleCalls() {
  const posts: unknown[] = []
  const deletes: string[] = []
  server.use(
    http.post(`${API}/trips/:tripId/vehicle`, async ({ request }) => {
      posts.push(await request.json())
      return HttpResponse.json({ success: true, data: { id: 'veh-new' } }, { status: 201 })
    }),
    http.delete(`${API}/trips/:tripId/vehicle/:vehicleId`, ({ params }) => {
      deletes.push(params.vehicleId as string)
      return HttpResponse.json({ success: true, data: null })
    }),
  )
  return { posts, deletes }
}

describe('useSyncVehicles — hasVehicleDataChanged (photo-aware diff)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    mockToast.mockClear()
  })

  it('detects a photo-only change and re-syncs (deletes old, creates new)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ photos: ['https://res.cloudinary.com/demo/old-1.jpg'] })]
    const incoming = [incomingVehicle({ photos: ['https://res.cloudinary.com/demo/new-1.jpg'] })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toEqual(['veh-1'])
    expect(posts).toHaveLength(1)
    expect((posts[0] as CreateVehicleDto).photos).toEqual(['https://res.cloudinary.com/demo/new-1.jpg'])
  })

  it('does NOT re-sync when nothing changed, including identical photos', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ photos: ['https://res.cloudinary.com/demo/same.jpg'] })]
    const incoming = [incomingVehicle({ photos: ['https://res.cloudinary.com/demo/same.jpg'] })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toHaveLength(0)
    expect(posts).toHaveLength(0)
  })

  it('treats undefined vs empty photos as unchanged (no false positive)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ photos: [] })]
    const incoming = [incomingVehicle({ photos: undefined })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toHaveLength(0)
    expect(posts).toHaveLength(0)
  })

  it('still detects a label change (pre-existing coverage)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ label: 'Innova' })]
    const incoming = [incomingVehicle({ label: 'Tempo Traveller' })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toEqual(['veh-1'])
    expect(posts).toHaveLength(1)
  })

  it('still detects a vehicleType change (pre-existing coverage)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ vehicleType: 'innova' })]
    const incoming = [incomingVehicle({ vehicleType: 'tempo' })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toEqual(['veh-1'])
    expect(posts).toHaveLength(1)
  })

  it('still detects a layout change (pre-existing coverage)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ layout: [['SEAT', 'SEAT']] })]
    const incoming = [incomingVehicle({ layout: [['SEAT', 'EMPTY']] })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toEqual(['veh-1'])
    expect(posts).toHaveLength(1)
  })

  it('still detects a layoutConfig change (pre-existing coverage)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const existing = [existingVehicle({ layoutConfig: { ...baseLayoutConfig, rows: 1 } })]
    const incoming = [incomingVehicle({ layoutConfig: { ...baseLayoutConfig, rows: 2 } })]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: existing }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toEqual(['veh-1'])
    expect(posts).toHaveLength(1)
  })

  it('creates without deleting when there are no existing vehicles (create-only path)', async () => {
    const { posts, deletes } = trackVehicleCalls()
    const incoming = [incomingVehicle()]

    const { result } = renderHook(() => useSyncVehicles({ tripId: TRIP_ID, existingVehicles: [] }), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.syncVehicles(incoming)
    })

    expect(deletes).toHaveLength(0)
    expect(posts).toHaveLength(1)
  })
})
