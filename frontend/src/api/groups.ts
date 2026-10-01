import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { GlobalPermission } from '#api/permissions'
import type { AccessRule } from '#api/access-rules'

export interface GroupSummary {
  id: string
  name: string
  description: string | null
  memberCount: number
  ruleCount: number
}

export interface GroupMember {
  id: string
  email: string
  displayName: string
}

export interface GroupDetail {
  id: string
  name: string
  description: string | null
  members: GroupMember[]
  permissions: GlobalPermission[]
  rules: AccessRule[]
}

export async function listGroups(): Promise<GroupSummary[]> {
  const { data } = await apiClient.get<ResponseDto<GroupSummary[]>>('/admin/groups')
  return data.data
}

export async function getGroupDetail(id: string): Promise<GroupDetail> {
  const { data } = await apiClient.get<ResponseDto<GroupDetail>>(`/admin/groups/${id}`)
  return data.data
}

export interface CreateGroupPayload {
  name: string
  description?: string
  userIds?: string[]
}

export async function createGroup(payload: CreateGroupPayload): Promise<{ id: string; name: string; description: string | null }> {
  const { data } = await apiClient.post<ResponseDto<{ id: string; name: string; description: string | null }>>(
    '/admin/groups',
    payload,
  )
  return data.data
}

export interface UpdateGroupPayload {
  name?: string
  description?: string
}

export async function updateGroup(
  id: string,
  payload: UpdateGroupPayload,
): Promise<{ id: string; name: string; description: string | null }> {
  const { data } = await apiClient.patch<ResponseDto<{ id: string; name: string; description: string | null }>>(
    `/admin/groups/${id}`,
    payload,
  )
  return data.data
}

export async function deleteGroup(id: string): Promise<void> {
  await apiClient.delete(`/admin/groups/${id}`)
}

export async function setGroupMembers(id: string, userIds: string[]): Promise<void> {
  await apiClient.put(`/admin/groups/${id}/members`, { userIds })
}
