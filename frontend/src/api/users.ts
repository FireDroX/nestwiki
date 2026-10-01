import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { AuthUser, UserRole } from '#api/auth'
import type { GlobalPermission, PageAction } from '#api/permissions'
import type { PageAccessRuleScope } from '#api/access-rules'

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<ResponseDto<AuthUser>>('/users/me')
  return data.data
}

export async function updateMe(payload: { displayName: string }): Promise<AuthUser> {
  const { data } = await apiClient.patch<ResponseDto<AuthUser>>('/users/me', payload)
  return data.data
}

export async function uploadAvatar(file: File): Promise<AuthUser> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<ResponseDto<AuthUser>>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export async function removeAvatar(): Promise<AuthUser> {
  const { data } = await apiClient.delete<ResponseDto<AuthUser>>('/users/me/avatar')
  return data.data
}

export interface AdminUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  avatarUrl: string | null
  createdAt: string
  groups?: { id: string; name: string }[]
  isActive?: boolean
  lockedUntil?: string | null
}

export interface PaginatedUsers {
  items: AdminUser[]
  total: number
  page: number
  limit: number
}

export interface ListUsersParams {
  page?: number
  limit?: number
  search?: string
  role?: UserRole
  groupId?: string
  active?: boolean
}

export async function listUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  const { page = 1, limit = 100, search, role, groupId, active } = params
  const { data } = await apiClient.get<ResponseDto<PaginatedUsers>>('/admin/users', {
    params: { page, limit, search, role, groupId, active },
  })
  return data.data
}

export interface AdminUserDetail extends AdminUser {
  groups: { id: string; name: string }[]
  directPermissions: GlobalPermission[]
  lastLoginAt: string | null
  lockedUntil: string | null
  failedLoginAttempts: number
}

export async function getUserDetail(id: string): Promise<AdminUserDetail> {
  const { data } = await apiClient.get<ResponseDto<AdminUserDetail>>(`/admin/users/${id}`)
  return data.data
}

export interface CreateUserPayload {
  email: string
  displayName: string
  role?: UserRole
  groupIds?: string[]
  permissions?: GlobalPermission[]
  password?: string
}

export interface CreateUserResult {
  user: AdminUser
  temporaryPassword: string | null
}

export async function createUser(payload: CreateUserPayload): Promise<CreateUserResult> {
  const { data } = await apiClient.post<ResponseDto<CreateUserResult>>('/admin/users', payload)
  return data.data
}

export interface UpdateUserPayload {
  displayName?: string
  email?: string
  role?: UserRole
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  const { data } = await apiClient.patch<ResponseDto<AdminUser>>(`/admin/users/${id}`, payload)
  return data.data
}

export async function setUserStatus(id: string, isActive: boolean): Promise<AdminUser> {
  const { data } = await apiClient.patch<ResponseDto<AdminUser>>(`/admin/users/${id}/status`, { isActive })
  return data.data
}

export async function resetUserPassword(id: string): Promise<string> {
  const { data } = await apiClient.post<ResponseDto<{ temporaryPassword: string }>>(`/admin/users/${id}/reset-password`)
  return data.data.temporaryPassword
}

export async function unlockUser(id: string): Promise<AdminUser> {
  const { data } = await apiClient.post<ResponseDto<AdminUser>>(`/admin/users/${id}/unlock`)
  return data.data
}

export async function setUserGroups(id: string, groupIds: string[]): Promise<AdminUserDetail> {
  const { data } = await apiClient.put<ResponseDto<AdminUserDetail>>(`/admin/users/${id}/groups`, { groupIds })
  return data.data
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`)
}

export type EffectivePermissionOrigin =
  | { type: 'direct' }
  | { type: 'group'; groupId: string; groupName: string }

export interface EffectiveGlobalPermission {
  permission: GlobalPermission
  origins: EffectivePermissionOrigin[]
}

export interface EffectiveAccessRule {
  id: string
  pageId: string | null
  appliesTo: PageAccessRuleScope
  actions: PageAction[]
  excludedPageIds: string[]
  origin: EffectivePermissionOrigin
}

export interface UserEffectivePermissions {
  isAdmin: boolean
  globalPermissions: EffectiveGlobalPermission[]
  accessRules: EffectiveAccessRule[]
}

export async function getEffectivePermissions(id: string): Promise<UserEffectivePermissions> {
  const { data } = await apiClient.get<ResponseDto<UserEffectivePermissions>>(`/admin/users/${id}/effective-permissions`)
  return data.data
}
