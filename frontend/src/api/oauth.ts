import { apiClient } from '#lib/api-client'
import type { ResponseDto } from '#api/response-dto'

export interface OAuthAuthorizeDecisionPayload {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  state?: string
  scope?: string
  decision: 'allow' | 'deny'
}

export interface OAuthAuthorizeDecisionResult {
  redirectUrl: string
}

export async function postAuthorizeDecision(
  payload: OAuthAuthorizeDecisionPayload,
): Promise<OAuthAuthorizeDecisionResult> {
  const { data } = await apiClient.post<ResponseDto<OAuthAuthorizeDecisionResult>>(
    '/oauth/authorize/decision',
    payload,
  )
  return data.data
}

export interface OAuthConsentClient {
  name: string
  redirectHost: string
  scopes: string[]
}

export async function getConsentClient(params: {
  clientId: string
  redirectUri: string
  scope?: string
}): Promise<OAuthConsentClient> {
  const { data } = await apiClient.get<ResponseDto<OAuthConsentClient>>('/oauth/authorize/client', {
    params: { client_id: params.clientId, redirect_uri: params.redirectUri, scope: params.scope },
  })
  return data.data
}
