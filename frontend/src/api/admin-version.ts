import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'

export interface VersionStatus {
  currentVersion: string
  latestVersion: string | null
  releaseUrl: string | null
  updateAvailable: boolean
}

export async function getVersionStatus(): Promise<VersionStatus> {
  const { data } = await apiClient.get<ResponseDto<VersionStatus>>('/admin/version')
  return data.data
}
