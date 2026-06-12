import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createServer as createHttpServer, type Server as HttpServer } from 'http'
import type { AddressInfo } from 'net'
import { PrismaClient } from '@prisma/client'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import type { Server } from 'socket.io'
import { createSocketServer } from '../../src/socket'
import { ChatService } from '../../src/services/chat.service'
import { ConversationRepository } from '../../src/repositories/conversation.repository'
import { MessageRepository } from '../../src/repositories/message.repository'
import { logger } from '../../src/utils/logger'
import type { AuthService } from '../../src/services/auth.service'

/**
 * Integration test — real Socket.IO server + real Postgres.
 *
 * Covers the chat send contract end-to-end:
 * - the service-level broadcast reaches room members for BOTH transports
 *   (socket send and the REST-fallback path, which calls the same service)
 * - clientMsgId idempotency: a retried send returns the original row and
 *   does not re-broadcast
 * - the socket path enforces the same zod contract as the REST route
 * - the per-socket rate limit rejects floods via the ack
 *
 * Run with: INTEGRATION_DB_URL=postgresql://... npx vitest run tests/integration/
 * Skips gracefully when no database is reachable (same pattern as the other
 * integration suites).
 */

// The presence handler (registered on every socket connection) talks to Redis
// when a client is available. @prisma/client re-loads .env on import, undoing
// tests/setup.ts's `delete process.env.REDIS_URL` — so without this mock the
// suite would issue commands against an unreachable Redis and leak unhandled
// rejections. Presence is out of scope here; chat itself never touches Redis.
vi.mock('../../src/config/redis', () => ({ redis: null }))

const DB_URL = process.env.INTEGRATION_DB_URL
  ?? process.env.DIRECT_URL
  ?? 'postgresql://travel_user:travel_pass@localhost:5432/travel_dev?schema=public'

const TEST_TOKEN = 'integration-test-token'

let prisma: PrismaClient
let httpServer: HttpServer
let io: Server
let baseUrl: string
let canConnect = false

let testUserId: string
let conversationId: string
let chatService: ChatService
const clientSockets: ClientSocket[] = []

function connectClient(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      auth: { token: TEST_TOKEN },
      transports: ['websocket'],
      reconnection: false,
    })
    clientSockets.push(socket)
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', (err) => reject(err))
    setTimeout(() => reject(new Error('socket connect timeout')), 5000)
  })
}

function joinRoom(socket: ClientSocket, convId: string): Promise<void> {
  socket.emit('chat:join', { conversationId: convId })
  // chat:join has no ack — give the server a beat to verify + join
  return new Promise((r) => setTimeout(r, 300))
}

type SendAck = { ok: boolean; messageId?: string; error?: string }

function sendViaSocket(socket: ClientSocket, payload: Record<string, unknown>): Promise<SendAck> {
  return socket.timeout(4000).emitWithAck('chat:send', payload) as Promise<SendAck>
}

/** Collects chat:message events; returns a snapshot getter */
function collectMessages(socket: ClientSocket) {
  const received: { id: string; content: string }[] = []
  socket.on('chat:message', (m: { id: string; content: string }) => received.push(m))
  return received
}

const waitABeat = (ms = 400) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: DB_URL })
  try {
    await prisma.$connect()
    canConnect = true
  } catch {
    console.warn(`⚠ Skipping chat socket integration tests — cannot connect to DB at ${DB_URL.replace(/:[^@]+@/, ':***@')}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      email: `chat-socket-it-${Date.now()}@test.local`,
      name: 'Chat Socket IT User',
      role: 'TRAVELER',
    },
  })
  testUserId = user.id

  /* eslint-disable @typescript-eslint/no-explicit-any -- narrow test doubles for wide service deps */
  const conversationRepo = new ConversationRepository(prisma as any)
  const messageRepo = new MessageRepository(prisma as any)
  const tripRepo = { findById: () => Promise.resolve(null) }
  const organizerProfileRepo = { findByUserId: () => Promise.resolve(null) }

  httpServer = createHttpServer()
  let ioRef: Server | null = null
  chatService = new ChatService(
    conversationRepo,
    messageRepo,
    tripRepo as any,
    organizerProfileRepo as any,
    logger as any,
    () => ioRef,
  )

  // Auth stub: the socket middleware only needs verifyAccessToken
  const authService = {
    verifyAccessToken: async (token: string) => {
      if (token !== TEST_TOKEN) throw new Error('invalid test token')
      return { userId: testUserId }
    },
  } as unknown as AuthService
  /* eslint-enable @typescript-eslint/no-explicit-any */

  io = createSocketServer(httpServer, authService, chatService, ['http://localhost'])
  ioRef = io

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const { port } = httpServer.address() as AddressInfo
  baseUrl = `http://localhost:${port}`

  const conversation = await conversationRepo.findOrCreateSupportChat(testUserId)
  conversationId = conversation.id
}, 30_000)

afterAll(async () => {
  clientSockets.forEach((s) => s.close())
  if (io) io.close()
  if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  if (canConnect) {
    await prisma.message.deleteMany({ where: { conversationId } })
    await prisma.conversation.deleteMany({ where: { id: conversationId } })
    await prisma.user.deleteMany({ where: { id: testUserId } })
    await prisma.$disconnect()
  }
})

describe('chat socket integration', () => {
  it('broadcasts chat:message to room members when a message is persisted via the service (REST-fallback path)', async () => {
    if (!canConnect) return

    const listener = await connectClient()
    await joinRoom(listener, conversationId)
    const received = collectMessages(listener)

    // Calling the service directly IS the REST path — the controller is a
    // thin wrapper around chatService.sendMessage
    const clientMsgId = crypto.randomUUID()
    const message = await chatService.sendMessage(conversationId, testUserId, {
      content: 'via rest path',
      clientMsgId,
    })

    await waitABeat()
    expect(received.some((m) => m.id === message.id)).toBe(true)
  })

  it('returns the original row and does NOT re-broadcast when the same clientMsgId is retried', async () => {
    if (!canConnect) return

    const listener = await connectClient()
    await joinRoom(listener, conversationId)
    const received = collectMessages(listener)

    const clientMsgId = crypto.randomUUID()
    const first = await chatService.sendMessage(conversationId, testUserId, { content: 'retry me', clientMsgId })
    await waitABeat()
    const broadcastsAfterFirst = received.length

    const second = await chatService.sendMessage(conversationId, testUserId, { content: 'retry me', clientMsgId })
    await waitABeat()

    expect(second.id).toBe(first.id)
    expect(received.length).toBe(broadcastsAfterFirst)
  })

  it('acks ok:true on a valid socket send and broadcasts exactly once', async () => {
    if (!canConnect) return

    const sender = await connectClient()
    const listener = await connectClient()
    await joinRoom(sender, conversationId)
    await joinRoom(listener, conversationId)
    const received = collectMessages(listener)

    const ack = await sendViaSocket(sender, {
      conversationId,
      content: 'via socket',
      clientMsgId: crypto.randomUUID(),
    })
    await waitABeat()

    expect(ack.ok).toBe(true)
    expect(ack.messageId).toBeTruthy()
    expect(received.filter((m) => m.id === ack.messageId)).toHaveLength(1)
  })

  it('rejects over-length content on the socket path with ok:false (same contract as REST)', async () => {
    if (!canConnect) return

    const sender = await connectClient()
    await joinRoom(sender, conversationId)

    const ack = await sendViaSocket(sender, {
      conversationId,
      content: 'x'.repeat(2001),
      clientMsgId: crypto.randomUUID(),
    })

    expect(ack.ok).toBe(false)
    expect(ack.error).toMatch(/2000/)
  })

  it('rejects a non-uuid clientMsgId on the socket path with ok:false', async () => {
    if (!canConnect) return

    const sender = await connectClient()
    await joinRoom(sender, conversationId)

    const ack = await sendViaSocket(sender, {
      conversationId,
      content: 'hello',
      clientMsgId: 'definitely-not-a-uuid',
    })

    expect(ack.ok).toBe(false)
  })

  it('rate-limits a flood of socket sends and reports the reason via the ack', async () => {
    if (!canConnect) return

    const sender = await connectClient() // fresh socket — rate limit is per-socket
    await joinRoom(sender, conversationId)

    let limited: SendAck | null = null
    for (let i = 0; i < 12; i++) {
      const ack = await sendViaSocket(sender, {
        conversationId,
        content: `flood ${i}`,
        clientMsgId: crypto.randomUUID(),
      })
      if (!ack.ok && /too fast/i.test(ack.error ?? '')) {
        limited = ack
        break
      }
    }

    expect(limited).not.toBeNull()
  }, 20_000)
})
