import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'

export interface BrokenPageLink {
  sourcePage: { id: string; title: string; path: string }
  targetPath: string
}

export interface BrokenPageLinkPage {
  items: BrokenPageLink[]
  total: number
}

export async function listBrokenLinks(params: { page?: number; limit?: number }): Promise<BrokenPageLinkPage> {
  const { data } = await apiClient.get<ResponseDto<BrokenPageLinkPage>>('/admin/links/broken', { params })
  return data.data
}
