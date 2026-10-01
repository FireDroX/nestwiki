import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { PageUpdateResult } from '#api/pages'

export interface VersionSummary {
  id: string
  authorId: string
  changeSummary: string | null
  createdAt: string
}

export interface VersionDetail extends VersionSummary {
  pageId: string
  title: string
  content: string
}

export interface PaginatedVersions {
  items: VersionSummary[]
  total: number
  page: number
  limit: number
}

export async function listVersions(pageId: string, page = 1, limit = 20): Promise<PaginatedVersions> {
  const { data } = await apiClient.get<ResponseDto<PaginatedVersions>>(`/pages/${pageId}/versions`, {
    params: { page, limit },
  })
  return data.data
}

export async function getVersion(pageId: string, versionId: string): Promise<VersionDetail> {
  const { data } = await apiClient.get<ResponseDto<VersionDetail>>(`/pages/${pageId}/versions/${versionId}`)
  return data.data
}

export type DiffChangeType = 'added' | 'removed' | 'unchanged'

export interface DiffChange {
  type: DiffChangeType
  value: string
}

export interface DiffResult {
  from: string
  to: string
  changes: DiffChange[]
}

export async function diffVersions(pageId: string, from: string, to: string): Promise<DiffResult> {
  const { data } = await apiClient.post<ResponseDto<DiffResult>>(`/pages/${pageId}/versions/diff`, { from, to })
  return data.data
}

export async function restoreVersion(pageId: string, versionId: string): Promise<PageUpdateResult> {
  const { data } = await apiClient.post<ResponseDto<PageUpdateResult>>(
    `/pages/${pageId}/versions/${versionId}/restore`,
  )
  return data.data
}

export interface Contributor {
  id: string
  displayName: string
  hasAvatar: boolean
}

export async function listContributors(pageId: string): Promise<Contributor[]> {
  const { data } = await apiClient.get<ResponseDto<Contributor[]>>(`/pages/${pageId}/versions/contributors`)
  return data.data
}
