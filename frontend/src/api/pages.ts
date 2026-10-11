import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'
import type { PageAction } from '#api/permissions'

export interface PageTreeNode {
  id: string
  slug: string
  title: string
  visibility: PageVisibility
  canCreateChild: boolean
  children: PageTreeNode[]
}

export async function getTree(): Promise<PageTreeNode[]> {
  const { data } = await apiClient.get<ResponseDto<PageTreeNode[]>>('/pages/tree')
  return data.data
}

export type PageVisibility = 'public' | 'private'

export interface PageDetail {
  id: string
  slug: string
  title: string
  content: string
  visibility: PageVisibility
  commentsEnabled: boolean
  parentId: string | null
  updatedAt: string
  isFollowed: boolean
  currentVersionId: string
  permissions: PageAction[]
}

export async function getPageByPath(pathSegments: string[]): Promise<PageDetail> {
  const path = pathSegments.map(encodeURIComponent).join('/')
  const { data } = await apiClient.get<ResponseDto<PageDetail>>(`/pages/${path}`)
  return data.data
}

export interface UpdatePagePayload {
  title?: string
  content?: string
  changeSummary?: string
  baseVersionId?: string
}

export type MergeSegment =
  | { type: 'ok'; lines: string[] }
  | { type: 'conflict'; mine: string[]; base: string[]; theirs: string[] }

export interface MergeConflictDetails {
  segments: MergeSegment[]
  currentVersionAuthorName: string | null
  currentVersionCreatedAt: string
  currentVersionContent: string
}

export interface PageUpdateResult {
  id: string
  slug: string
  title: string
  content: string
  currentVersionId: string
  updatedAt: string
  conflict: boolean
  mergedContent?: string
  segments?: MergeSegment[]
  currentVersionAuthorName?: string | null
  currentVersionCreatedAt?: string
  currentVersionContent?: string
}

export async function updatePage(id: string, payload: UpdatePagePayload): Promise<PageUpdateResult> {
  const { data } = await apiClient.patch<ResponseDto<PageUpdateResult>>(`/pages/${id}`, payload)
  return data.data
}

export interface CreatePagePayload {
  slug: string
  title: string
  content: string
  visibility: PageVisibility
  parentId: string | null
}

export interface PageCreateResult {
  id: string
  slug: string
  title: string
  parentId: string | null
  visibility: PageVisibility
}

export async function createPage(payload: CreatePagePayload): Promise<PageCreateResult> {
  const { data } = await apiClient.post<ResponseDto<PageCreateResult>>('/pages', payload)
  return data.data
}

export async function movePage(id: string, newParentId: string | null): Promise<void> {
  await apiClient.patch(`/pages/${id}/move`, { newParentId })
}

export async function changePageVisibility(id: string, visibility: PageVisibility): Promise<void> {
  await apiClient.patch(`/pages/${id}/visibility`, { visibility })
}

export async function setCommentsEnabled(id: string, commentsEnabled: boolean): Promise<void> {
  await apiClient.patch(`/pages/${id}/comments-enabled`, { commentsEnabled })
}

export async function followPage(id: string): Promise<void> {
  await apiClient.post(`/pages/${id}/follow`)
}

export async function unfollowPage(id: string): Promise<void> {
  await apiClient.delete(`/pages/${id}/follow`)
}

export async function deletePage(id: string, cascade: boolean): Promise<void> {
  await apiClient.delete(`/pages/${id}`, { params: cascade ? { cascade: 'true' } : undefined })
}

export interface TrashEntry {
  id: string
  title: string
  path: string
  deletedAt: string
  deletedBy: { id: string; displayName: string } | null
  descendantCount: number
}

export async function listTrash(): Promise<TrashEntry[]> {
  const { data } = await apiClient.get<ResponseDto<TrashEntry[]>>('/pages/trash')
  return data.data
}

export async function restorePage(id: string): Promise<void> {
  await apiClient.post(`/pages/${id}/restore`)
}

export async function purgePage(id: string): Promise<void> {
  await apiClient.delete(`/pages/${id}/purge`)
}

export interface MergePreviewPayload {
  baseVersionId: string
  content: string
}

export interface MergePreviewResult {
  conflict: boolean
  mergedContent: string
  newBaseVersionId: string
  segments?: MergeSegment[]
  currentVersionAuthorName?: string | null
  currentVersionCreatedAt?: string
  currentVersionContent?: string
}

export async function mergePreview(id: string, payload: MergePreviewPayload): Promise<MergePreviewResult> {
  const { data } = await apiClient.post<ResponseDto<MergePreviewResult>>(`/pages/${id}/merge-preview`, payload)
  return data.data
}
