import { OAuthClient } from '../entities/oauth-client.entity.js';

export interface CreateOAuthClientInput {
  clientId: string;
  clientSecretHash: string;
  redirectUris: string[];
  name: string;
}

export interface OAuthClientRepository {
  create(data: CreateOAuthClientInput): Promise<OAuthClient>;
  findAll(): Promise<OAuthClient[]>;
  findById(id: string): Promise<OAuthClient | null>;
  findByClientId(clientId: string): Promise<OAuthClient | null>;
  deleteWithoutTokensCreatedBefore(cutoff: Date): Promise<void>;
}
