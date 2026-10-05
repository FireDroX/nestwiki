import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '#hooks/useAuth'
import type { AuthUser } from '#api/auth'
import { PageTreeProvider } from './PageTreeProvider'

vi.mock('#lib/realtime-client', () => ({
  getRealtimeSocket: () => ({ on: vi.fn(), off: vi.fn() }),
}))

const getTreeMock = vi.fn()
vi.mock('#api/pages', () => ({
  getTree: (...args: unknown[]) => getTreeMock(...args),
}))

function authValue(status: AuthContextValue['status'], user: AuthUser | null): AuthContextValue {
  return {
    status,
    user,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }
}

const admin = { id: 'admin-1', role: 'admin' } as AuthUser

function renderWithAuth(value: AuthContextValue) {
  return render(
    <AuthContext.Provider value={value}>
      <PageTreeProvider>
        <div />
      </PageTreeProvider>
    </AuthContext.Provider>,
  )
}

describe('PageTreeProvider', () => {
  beforeEach(() => {
    getTreeMock.mockReset()
    getTreeMock.mockResolvedValue([])
  })

  it('waits for the session to be resolved before fetching the tree', async () => {
    const { rerender } = renderWithAuth(authValue('loading', null))

    expect(getTreeMock).not.toHaveBeenCalled()

    rerender(
      <AuthContext.Provider value={authValue('authenticated', admin)}>
        <PageTreeProvider>
          <div />
        </PageTreeProvider>
      </AuthContext.Provider>,
    )

    await waitFor(() => expect(getTreeMock).toHaveBeenCalledTimes(1))
  })

  it('refetches the tree when the signed-in user changes', async () => {
    const { rerender } = renderWithAuth(authValue('unauthenticated', null))
    await waitFor(() => expect(getTreeMock).toHaveBeenCalledTimes(1))

    rerender(
      <AuthContext.Provider value={authValue('authenticated', admin)}>
        <PageTreeProvider>
          <div />
        </PageTreeProvider>
      </AuthContext.Provider>,
    )

    await waitFor(() => expect(getTreeMock).toHaveBeenCalledTimes(2))
  })
})
