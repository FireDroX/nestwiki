import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { GlobalPermission, PageAction } from '#api/permissions'

export type AccessRuleSubjectType = 'user' | 'group'

export interface AccessRuleSubject {
  type: AccessRuleSubjectType
  id: string
}

export type PageAccessRuleScope = 'page' | 'subtree'

export interface AccessRule {
  id: string
  pageId: string | null
  appliesTo: PageAccessRuleScope
  actions: PageAction[]
  excludedPageIds: string[]
  grantedById: string
  createdAt: string
}

export interface CreateAccessRulePayload {
  pageId: string | null
  appliesTo: PageAccessRuleScope
  actions: PageAction[]
  excludedPageIds?: string[]
}

export interface UpdateAccessRulePayload {
  actions?: PageAction[]
  excludedPageIds?: string[]
}

function basePath(subject: AccessRuleSubject): string {
  return subject.type === 'user' ? `/admin/users/${subject.id}` : `/admin/groups/${subject.id}`
}

export async function listAccessRules(subject: AccessRuleSubject): Promise<AccessRule[]> {
  const { data } = await apiClient.get<ResponseDto<AccessRule[]>>(`${basePath(subject)}/access-rules`)
  return data.data
}

export async function createAccessRule(subject: AccessRuleSubject, payload: CreateAccessRulePayload): Promise<AccessRule> {
  const { data } = await apiClient.post<ResponseDto<AccessRule>>(`${basePath(subject)}/access-rules`, payload)
  return data.data
}

export async function updateAccessRule(
  subject: AccessRuleSubject,
  ruleId: string,
  payload: UpdateAccessRulePayload,
): Promise<AccessRule> {
  const { data } = await apiClient.patch<ResponseDto<AccessRule>>(`${basePath(subject)}/access-rules/${ruleId}`, payload)
  return data.data
}

export async function deleteAccessRule(subject: AccessRuleSubject, ruleId: string): Promise<void> {
  await apiClient.delete(`${basePath(subject)}/access-rules/${ruleId}`)
}

export async function setGlobalPermissions(subject: AccessRuleSubject, permissions: GlobalPermission[]): Promise<void> {
  await apiClient.put(`${basePath(subject)}/permissions`, { permissions })
}
