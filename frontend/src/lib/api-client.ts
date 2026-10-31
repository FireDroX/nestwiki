import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ResponseDto } from '#api/response-dto'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<void> | null = null

async function refreshAccessToken(): Promise<void> {
  await axios.post<ResponseDto<null>>(
    `${import.meta.env.VITE_API_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  )
}

export function refreshSession(): Promise<void> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

export const AUTH_LOGOUT_EVENT = 'auth:logout'

function logout(): void {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
  void apiClient.post('/auth/logout').catch(() => {})
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }
    originalRequest._retry = true

    try {
      await refreshSession()
      const { reconnectRealtimeSocket } = await import('#lib/realtime-client')
      reconnectRealtimeSocket()
      return apiClient(originalRequest)
    } catch (refreshError) {
      logout()
      return Promise.reject(refreshError)
    }
  },
)
