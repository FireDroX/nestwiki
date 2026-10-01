import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { PageAction } from '#api/permissions'
import type { AccessRuleSubjectType, PageAccessRuleScope } from '#api/access-rules'

export interface BasePageAccessRule {
  id: string
  pageId: string | null
  appliesTo: PageAccessRuleScope
  actions: PageAction[]
  excludedPageIds: string[]
  grantedById: string
  createdAt: string
}

export interface PageAccessRule extends BasePageAccessRule {
  inherited: boolean
  subject: { type: AccessRuleSubjectType; id: string; name: string }
}

export async function listPageAccessRules(pageId: string): Promise<PageAccessRule[]> {
  const { data } = await apiClient.get<ResponseDto<PageAccessRule[]>>(`/pages/${pageId}/access-rules`)
  return data.data
}

export interface CreatePageAccessRulePayload {
  subject: { type: AccessRuleSubjectType; id: string }
  appliesTo: PageAccessRuleScope
  actions: PageAction[]
  excludedPageIds?: string[]
}

export async function createPageAccessRule(
  pageId: string,
  payload: CreatePageAccessRulePayload,
): Promise<BasePageAccessRule> {
  const { data } = await apiClient.post<ResponseDto<BasePageAccessRule>>(`/pages/${pageId}/access-rules`, payload)
  return data.data
}

export interface UpdatePageAccessRulePayload {
  actions?: PageAction[]
  excludedPageIds?: string[]
}

export async function updatePageAccessRule(
  pageId: string,
  ruleId: string,
  payload: UpdatePageAccessRulePayload,
): Promise<BasePageAccessRule> {
  const { data } = await apiClient.patch<ResponseDto<BasePageAccessRule>>(
    `/pages/${pageId}/access-rules/${ruleId}`,
    payload,
  )
  return data.data
}

export async function deletePageAccessRule(pageId: string, ruleId: string): Promise<void> {
  await apiClient.delete(`/pages/${pageId}/access-rules/${ruleId}`)
}
