import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'

export const OAUTH_AUDIT_KEY_PREFIX = 'oauth:'

export interface OAuthActiveTokenSummary {
  id: string
  userId: string
  userDisplayName: string
  userEmail: string
  createdAt: string
  expiresAt: string
}

export interface OAuthClientSummary {
  id: string
  clientId: string
  name: string
  createdAt: string
  activeTokens: OAuthActiveTokenSummary[]
}

export async function listOAuthClients(): Promise<OAuthClientSummary[]> {
  const { data } = await apiClient.get<ResponseDto<OAuthClientSummary[]>>('/admin/mcp/oauth-clients')
  return data.data
}

export async function revokeOAuthToken(clientId: string, tokenId: string): Promise<void> {
  await apiClient.delete(`/admin/mcp/oauth-clients/${clientId}/tokens/${tokenId}`)
}
