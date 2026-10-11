import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { extractErrorMessage } from '#lib/api-errors'
import { downloadPageExport } from './pages'

const getMock = vi.fn()
vi.mock('#lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))

function blobError(body: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    config,
    data: new Blob([body], { type: 'application/json' }),
  })
}

describe('downloadPageExport', () => {
  it('exposes the server error message even though the response was requested as a file', async () => {
    getMock.mockRejectedValue(blobError(JSON.stringify({ error: 'You do not have access to this page' })))

    const failure = await downloadPageExport('p1', 'page').catch((error: unknown) => error)

    expect(extractErrorMessage(failure, 'fallback')).toBe('You do not have access to this page')
  })

  it('keeps the generic message when the error body is not JSON', async () => {
    getMock.mockRejectedValue(blobError('<html>Bad gateway</html>'))

    const failure = await downloadPageExport('p1', 'page').catch((error: unknown) => error)

    expect(extractErrorMessage(failure, 'fallback')).toBe('fallback')
  })
})
