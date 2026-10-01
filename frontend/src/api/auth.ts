import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { GlobalPermission } from '#api/permissions'

export interface LoginPayload {
  email: string
  password: string
  turnstileToken: string
}

export interface RegisterPayload {
  email: string
  password: string
  displayName: string
  turnstileToken: string
}

export const UserRole = {
  Admin: 'admin',
  Member: 'member',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export interface AuthUserGroup {
  id: string
  name: string
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  hasAvatar: boolean
  createdAt: string
  commentsCount?: number
  pagesCreatedCount?: number
  pageEditsCount?: number
  permissions?: GlobalPermission[]
  groups?: AuthUserGroup[]
}

export async function login(payload: LoginPayload): Promise<void> {
  await apiClient.post<ResponseDto<null>>('/auth/login', payload)
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const { data } = await apiClient.post<ResponseDto<AuthUser>>('/auth/register', payload)
  return data.data
}

export async function logout(): Promise<void> {
  await apiClient.post<ResponseDto<null>>('/auth/logout')
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch<ResponseDto<null>>('/auth/password', { currentPassword, newPassword })
}
