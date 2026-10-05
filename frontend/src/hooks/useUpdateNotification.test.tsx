import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '#hooks/useAuth'
import type { AuthUser } from '#api/auth'
import type { VersionStatus } from '#api/admin-version'
import { DISMISSED_UPDATE_KEY, useUpdateNotification } from './useUpdateNotification'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}))

const getVersionStatus = vi.fn<() => Promise<VersionStatus>>()
vi.mock('#api/admin-version', () => ({
  getVersionStatus: () => getVersionStatus(),
}))

const UPDATE: VersionStatus = {
  currentVersion: '1.0.7',
  latestVersion: '1.1.0',
  releaseUrl: 'https://github.com/FireDroX/nestwiki/releases/tag/v1.1.0',
  updateAvailable: true,
}

function wrapperFor(role: 'admin' | 'member' | null) {
  const value = {
    status: role ? 'authenticated' : 'unauthenticated',
    user: role ? ({ id: 'u1', role } as AuthUser) : null,
  } as AuthContextValue
  return ({ children }: { children: ReactNode }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

describe('useUpdateNotification', () => {
  beforeEach(() => {
    toastError.mockReset()
    getVersionStatus.mockReset()
    getVersionStatus.mockResolvedValue(UPDATE)
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('shows a red toast at the top of the screen for an admin when a newer version exists', async () => {
    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('admin') })

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    const [title, options] = toastError.mock.calls[0] as [string, Record<string, unknown>]
    expect(title).toContain('1.1.0')
    expect(options).toMatchObject({ position: 'top-center', duration: Infinity })
    expect(String(options.description)).toContain('1.0.7')
  })

  it('never checks the version for members or visitors', async () => {
    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('member') })
    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor(null) })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getVersionStatus).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('stays silent when the instance is up to date', async () => {
    getVersionStatus.mockResolvedValue({ ...UPDATE, latestVersion: '1.0.7', updateAvailable: false })

    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('admin') })

    await waitFor(() => expect(getVersionStatus).toHaveBeenCalled())
    expect(toastError).not.toHaveBeenCalled()
  })

  it('remembers an ignored version and only warns again for a newer one', async () => {
    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('admin') })
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    const options = toastError.mock.calls[0][1] as { cancel: { onClick: () => void } }

    options.cancel.onClick()
    expect(localStorage.getItem(DISMISSED_UPDATE_KEY)).toBe('1.1.0')

    toastError.mockReset()
    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('admin') })
    await waitFor(() => expect(getVersionStatus).toHaveBeenCalledTimes(2))
    expect(toastError).not.toHaveBeenCalled()

    getVersionStatus.mockResolvedValue({ ...UPDATE, latestVersion: '1.2.0' })
    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('admin') })
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
  })

  it('ignores a failed version check', async () => {
    getVersionStatus.mockRejectedValue(new Error('offline'))

    renderHook(() => useUpdateNotification(), { wrapper: wrapperFor('admin') })

    await waitFor(() => expect(getVersionStatus).toHaveBeenCalled())
    expect(toastError).not.toHaveBeenCalled()
  })
})
