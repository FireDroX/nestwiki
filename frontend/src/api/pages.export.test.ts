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

async function downloadedFilename(disposition: string | undefined, scope: 'page' | 'subtree' = 'page'): Promise<string> {
  getMock.mockResolvedValue({
    data: new Blob(['content']),
    headers: disposition === undefined ? {} : { 'content-disposition': disposition },
  })
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:export', revokeObjectURL: () => undefined })
  let filename = ''
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download
  })
  await downloadPageExport('p1', scope)
  click.mockRestore()
  vi.unstubAllGlobals()
  return filename
}

describe('downloadPageExport', () => {
  it.each([
    ['attachment; filename=guide.md', 'guide.md'],
    ['attachment; filename="mon guide.md"', 'mon guide.md'],
    ['attachment; filename="a\\"b.md"', 'a"b.md'],
    [`attachment; filename="?t?.md"; filename*=UTF-8''%C3%A9t%C3%A9.md`, 'été.md'],
  ])('names the downloaded file from %s', async (disposition, expected) => {
    expect(await downloadedFilename(disposition)).toBe(expected)
  })

  it('falls back to a default name when the header is missing', async () => {
    expect(await downloadedFilename(undefined, 'subtree')).toBe('pages.zip')
  })

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
