import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from './api-errors'

function axiosError(status: number, data: unknown, headers: Record<string, string> = {}): AxiosError {
  const response = {
    status,
    data,
    headers,
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('Request failed', undefined, undefined, undefined, response)
}

describe('extractErrorMessage', () => {
  it('turns a 429 into a localized message with the Retry-After delay', () => {
    const error = axiosError(429, { error: 'ThrottlerException: Too Many Requests' }, { 'retry-after': '42' })

    expect(extractErrorMessage(error)).toBe('Trop de requêtes, réessayez dans 42 s.')
  })

  it('falls back to a message without delay when Retry-After is missing or invalid', () => {
    expect(extractErrorMessage(axiosError(429, {}))).toBe('Trop de requêtes, patientez un instant avant de réessayer.')
    expect(extractErrorMessage(axiosError(429, {}, { 'retry-after': 'soon' }))).toBe(
      'Trop de requêtes, patientez un instant avant de réessayer.',
    )
  })

  it('keeps returning the backend error message for other statuses', () => {
    expect(extractErrorMessage(axiosError(404, { error: 'Page not found' }))).toBe('Page not found')
  })

  it('returns the fallback when there is no usable message', () => {
    expect(extractErrorMessage(axiosError(500, {}), 'fallback')).toBe('fallback')
    expect(extractErrorMessage(new Error('network'), 'fallback')).toBe('fallback')
  })
})
