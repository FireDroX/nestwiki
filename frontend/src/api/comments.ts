import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'

export interface Comment {
  id: string
  pageId: string
  authorId: string
  authorDisplayName: string | null
  authorHasAvatar: boolean
  parentId: string | null
  content: string
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  replies?: Comment[]
}

export async function listComments(pageId: string): Promise<Comment[]> {
  const { data } = await apiClient.get<ResponseDto<Comment[]>>(`/pages/${pageId}/comments`)
  return data.data
}

export async function createComment(
  pageId: string,
  content: string,
  parentId?: string,
): Promise<Comment> {
  const { data } = await apiClient.post<ResponseDto<Comment>>(`/pages/${pageId}/comments`, {
    content,
    parentId,
  })
  return data.data
}

export async function updateComment(commentId: string, content: string): Promise<Comment> {
  const { data } = await apiClient.patch<ResponseDto<Comment>>(`/comments/${commentId}`, {
    content,
  })
  return data.data
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/comments/${commentId}`)
}

export interface AdminUserComment {
  id: string
  pageId: string
  pagePath: string | null
  content: string
  deletedAt: string | null
  createdAt: string
}

export interface PaginatedUserComments {
  items: AdminUserComment[]
  total: number
  page: number
  limit: number
}

export async function listUserComments(
  userId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedUserComments> {
  const { data } = await apiClient.get<ResponseDto<PaginatedUserComments>>(
    `/admin/users/${userId}/comments`,
    { params: { page, limit } },
  )
  return data.data
}

export async function purgeUserComments(userId: string, commentIds?: string[]): Promise<number> {
  const { data } = await apiClient.delete<ResponseDto<{ purgedCount: number }>>(
    `/admin/users/${userId}/comments`,
    commentIds ? { data: { commentIds } } : undefined,
  )
  return data.data.purgedCount
}
