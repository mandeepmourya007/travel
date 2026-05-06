import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'

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

  if (process.env.NODE_ENV === 'development') {
    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.debug('[Socket] Connected:', socket?.id)
    })

    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.debug('[Socket] Disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      // eslint-disable-next-line no-console
      console.debug('[Socket] Connection error:', error.message)
    })
  }

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
