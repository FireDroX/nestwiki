import { io, type Socket } from 'socket.io-client'
import { AUTH_LOGOUT_EVENT, refreshSession } from '#lib/api-client'

const SERVER_DISCONNECT_REASON = 'io server disconnect'
const MIN_SESSION_RECONNECT_INTERVAL_MS = 10_000

let socket: Socket | null = null
let lastSessionReconnectAt = 0

function realtimeOrigin(): string {
  return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
}

async function reconnectWithFreshSession(): Promise<void> {
  const now = Date.now()
  if (now - lastSessionReconnectAt < MIN_SESSION_RECONNECT_INTERVAL_MS) {
    return
  }
  lastSessionReconnectAt = now
  try {
    await refreshSession()
  } catch {
    return
  }
  socket?.connect()
}

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(realtimeOrigin(), { withCredentials: true })
    socket.on('disconnect', (reason) => {
      if (reason === SERVER_DISCONNECT_REASON) {
        void reconnectWithFreshSession()
      }
    })
  }
  return socket
}

export function reconnectRealtimeSocket(): void {
  socket?.disconnect()
  socket?.connect()
}

window.addEventListener(AUTH_LOGOUT_EVENT, () => reconnectRealtimeSocket())
