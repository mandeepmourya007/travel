import { io, Socket } from 'socket.io-client'
import { feLogger } from '@/lib/logger'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  })

  socket.on('connect', () => {
    feLogger.debug('Socket connected', { socketId: socket?.id })
  })

  socket.on('disconnect', (reason) => {
    feLogger.debug('Socket disconnected', { reason })
  })

  socket.on('connect_error', (error) => {
    feLogger.warn('Socket connection error', { message: error.message })
  })

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
