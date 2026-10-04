import { isAxiosError, type AxiosError } from 'axios'
import i18n from '#lib/i18n'

const TOO_MANY_REQUESTS_STATUS = 429

export function extractErrorMessage(error: unknown, fallback = i18n.t('errors.generic')): string {
  if (isAxiosError(error) && error.response?.status === TOO_MANY_REQUESTS_STATUS) {
    return tooManyRequestsMessage(error)
  }
  if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error
  }
  return fallback
}

function tooManyRequestsMessage(error: AxiosError): string {
  const retryAfterSeconds = Number(error.response?.headers['retry-after'])
  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? i18n.t('errors.tooManyRequests', { seconds: retryAfterSeconds })
    : i18n.t('errors.tooManyRequestsNoDelay')
}
