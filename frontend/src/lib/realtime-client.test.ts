import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers: Record<string, (reason: string) => void> = {}
const socketMock = {
  on: vi.fn((event: string, handler: (reason: string) => void) => {
    handlers[event] = handler
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
}
const refreshSessionMock = vi.fn()

vi.mock('socket.io-client', () => ({ io: () => socketMock }))
vi.mock('#lib/api-client', () => ({
  AUTH_LOGOUT_EVENT: 'auth:logout',
  refreshSession: () => refreshSessionMock(),
}))

describe('realtime client', () => {
  beforeEach(() => {
    vi.resetModules()
    socketMock.connect.mockReset()
    refreshSessionMock.mockReset()
  })

  it('refreshes the session and reconnects when the server ends an expired session', async () => {
    refreshSessionMock.mockResolvedValue(undefined)
    const { getRealtimeSocket } = await import('./realtime-client')
    getRealtimeSocket()

    handlers.disconnect('io server disconnect')
    await vi.waitFor(() => expect(socketMock.connect).toHaveBeenCalled())
    expect(refreshSessionMock).toHaveBeenCalled()
  })

  it('stays disconnected when the session cannot be refreshed', async () => {
    refreshSessionMock.mockRejectedValue(new Error('expired'))
    const { getRealtimeSocket } = await import('./realtime-client')
    getRealtimeSocket()

    handlers.disconnect('io server disconnect')
    await vi.waitFor(() => expect(refreshSessionMock).toHaveBeenCalled())
    expect(socketMock.connect).not.toHaveBeenCalled()
  })

  it('leaves network drops to the built-in reconnection', async () => {
    const { getRealtimeSocket } = await import('./realtime-client')
    getRealtimeSocket()

    handlers.disconnect('transport close')

    expect(refreshSessionMock).not.toHaveBeenCalled()
  })
})
