export interface OAuthClientRegisteredResponseDto {
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  redirect_uris: string[];
  client_name: string;
}

export interface OAuthRefreshTokenSummaryDto {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OAuthClientSummaryDto {
  id: string;
  clientId: string;
  name: string;
  createdAt: Date;
  activeTokens: OAuthRefreshTokenSummaryDto[];
}

export interface OAuthConsentClientDto {
  name: string;
  redirectHost: string;
  scopes: string[];
}
