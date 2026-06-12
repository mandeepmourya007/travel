import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from '@/test/mocks/server'
import { API_BASE_URL as API } from '@/test/test-constants'
import { chatKeys } from '@/lib/query-keys'
import type { Message } from '@shared/types/chat.types'

// ── Mocks ────────────────────────────────────────────

const mockToast = vi.fn()
vi.mock('@/components/shared/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/store/auth.store', () => {
  const state = {
    isAuthenticated: true,
    _hasHydrated: true,
    accessToken: 'test-jwt',
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'TRAVELER', avatarUrl: null },
  }
  const useAuthStore = (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(state) : state
  useAuthStore.getState = () => state
  return { useAuthStore }
})

// Controllable socket — each test configures emitWithAck behaviour
const mockEmitWithAck = vi.fn()
let mockConnected = true
vi.mock('@/lib/socket', () => ({
  getSocket: () => ({
    connected: mockConnected,
    timeout: () => ({ emitWithAck: mockEmitWithAck }),
  }),
}))

// Import AFTER mocks
import { useSendMessage } from '../use-chat'

// ── Helpers ──────────────────────────────────────────

const CONVERSATION_ID = 'conv-1'

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function seedMessagesCache(queryClient: QueryClient, messages: Message[] = []) {
  queryClient.setQueryData(chatKeys.messages(CONVERSATION_ID), {
    pages: [{ data: messages, hasMore: false, nextCursor: null }],
    pageParams: [undefined],
  })
}

function getCachedMessages(queryClient: QueryClient): Message[] {
  const data = queryClient.getQueryData<{ pages: { data: Message[] }[] }>(
    chatKeys.messages(CONVERSATION_ID),
  )
  return data?.pages.flatMap((p) => p.data) ?? []
}

/** Tracks whether the REST fallback endpoint was hit; replies like the real server */
function trackRestSends(status = 201, messageId = 'msg-rest-1') {
  const calls: unknown[] = []
  server.use(
    http.post(`${API}/chat/conversations/:id/messages`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.push(body)
      if (status >= 400) {
        return HttpResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Conversation is closed' } },
          { status },
        )
      }
      return HttpResponse.json(
        {
          success: true,
          data: {
            id: messageId,
            conversationId: CONVERSATION_ID,
            senderId: 'user-1',
            type: 'TEXT',
            content: body.content,
            clientMsgId: body.clientMsgId ?? null,
            reactions: [],
            createdAt: new Date().toISOString(),
          },
        },
        { status },
      )
    }),
  )
  return calls
}

// ── Tests ────────────────────────────────────────────

describe('useSendMessage — socket ack + REST fallback (P1-4)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    mockToast.mockClear()
    mockEmitWithAck.mockReset()
    mockConnected = true
  })

  it('inserts an optimistic message and does NOT hit REST when the socket acks ok', async () => {
    const restCalls = trackRestSends()
    mockEmitWithAck.mockResolvedValue({ ok: true, messageId: 'msg-real-1' })
    seedMessagesCache(queryClient)

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'hello' })
    })

    expect(mockEmitWithAck).toHaveBeenCalledWith('chat:send', {
      conversationId: CONVERSATION_ID,
      content: 'hello',
      clientMsgId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
    expect(restCalls).toHaveLength(0)
    // Optimistic message visible (echo replacement is the socket handler's job)
    expect(getCachedMessages(queryClient).some((m) => m.content === 'hello')).toBe(true)
  })

  it('rolls back and surfaces the server reason when the ack is ok:false — never bypasses the rejection via REST', async () => {
    const restCalls = trackRestSends()
    mockEmitWithAck.mockResolvedValue({ ok: false, error: 'You are sending messages too fast. Please slow down.' })
    seedMessagesCache(queryClient)

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'hello' })
    })

    // An explicit server rejection (rate limit, closed conversation) must not
    // be retried over REST — that would bypass the very thing that rejected it
    expect(restCalls).toHaveLength(0)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        title: 'Message not sent',
        description: 'You are sending messages too fast. Please slow down.',
      }),
    )
    expect(getCachedMessages(queryClient).some((m) => m.content === 'hello')).toBe(false)
  })

  it('retries over REST after an ack timeout; a server-deduped response does not duplicate the echoed message', async () => {
    // Simulate: send reached the server and the echo replaced the optimistic
    // temp-* message, but the ack itself timed out. The REST retry then gets
    // the SAME row back (server dedupes on clientMsgId) — no duplicate.
    const restCalls = trackRestSends(201, 'msg-from-echo')
    seedMessagesCache(queryClient)
    mockEmitWithAck.mockImplementation(async () => {
      const data = queryClient.getQueryData<{ pages: { data: Message[] }[]; pageParams: unknown[] }>(
        chatKeys.messages(CONVERSATION_ID),
      )!
      const reconciled = data.pages[0].data.map((m) =>
        m.id.startsWith('temp-') ? { ...m, id: 'msg-from-echo' } : m,
      )
      queryClient.setQueryData(chatKeys.messages(CONVERSATION_ID), {
        ...data,
        pages: [{ ...data.pages[0], data: reconciled }],
      })
      throw new Error('operation has timed out')
    })

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'hello' })
    })

    await waitFor(() => expect(restCalls).toHaveLength(1))
    const contents = getCachedMessages(queryClient).filter((m) => m.content === 'hello')
    expect(contents).toHaveLength(1)
  })

  it('resends over REST after an ack timeout when the message was NOT reconciled', async () => {
    const restCalls = trackRestSends()
    seedMessagesCache(queryClient)
    mockEmitWithAck.mockRejectedValue(new Error('operation has timed out'))

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'hello' })
    })

    await waitFor(() => expect(restCalls).toHaveLength(1))
  })

  it('sends the SAME clientMsgId over socket and the REST retry — the server dedupe key', async () => {
    const restCalls = trackRestSends()
    seedMessagesCache(queryClient)
    mockEmitWithAck.mockRejectedValue(new Error('operation has timed out'))

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'hello' })
    })

    await waitFor(() => expect(restCalls).toHaveLength(1))
    const socketPayload = mockEmitWithAck.mock.calls[0][1] as { clientMsgId?: string }
    const restPayload = restCalls[0] as { clientMsgId?: string }
    expect(socketPayload.clientMsgId).toBeTruthy()
    // Identical key on both transports → a send that persisted via socket
    // maps the REST retry onto the same DB row instead of duplicating
    expect(restPayload.clientMsgId).toBe(socketPayload.clientMsgId)
  })

  it('generates a distinct clientMsgId per message (rapid identical sends stay distinct)', async () => {
    trackRestSends()
    mockEmitWithAck.mockResolvedValue({ ok: true })
    seedMessagesCache(queryClient)

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'same text' })
      await result.current.sendMessage({ content: 'same text' })
    })

    const ids = mockEmitWithAck.mock.calls.map((c) => (c[1] as { clientMsgId: string }).clientMsgId)
    expect(ids[0]).not.toBe(ids[1])
    // Both optimistic bubbles coexist — temp ids derive from the unique key
    expect(getCachedMessages(queryClient).filter((m) => m.content === 'same text')).toHaveLength(2)
  })

  it('rolls back the optimistic message and toasts when REST also fails (no silent loss)', async () => {
    trackRestSends(403)
    mockConnected = false // socket down → straight to REST
    seedMessagesCache(queryClient)

    const { result } = renderHook(() => useSendMessage(CONVERSATION_ID), {
      wrapper: makeWrapper(queryClient),
    })

    await act(async () => {
      await result.current.sendMessage({ content: 'hello' })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: 'Message not sent',
        }),
      )
    })
    // The bubble must not sit in the UI looking delivered
    expect(getCachedMessages(queryClient).some((m) => m.content === 'hello')).toBe(false)
  })
})
