import { randomBytes, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { OAuthInvalidClientException } from '../../common/exceptions/mcp/oauth-invalid-client.exception.js';
import { OAuthInvalidRequestException } from '../../common/exceptions/mcp/oauth-invalid-request.exception.js';
import { OAuthRefreshTokenNotFoundException } from '../../common/exceptions/mcp/oauth-refresh-token-not-found.exception.js';
import {
  OAUTH_CLIENT_ID_PREFIX,
  OAUTH_CLIENT_SECRET_PREFIX,
} from '../../common/variables.global.js';
import { UsersService } from '../../users/services/users.service.js';
import { RegisterOAuthClientDto } from '../dto/in/register-oauth-client.dto.js';
import { OAuthClient } from '../entities/oauth-client.entity.js';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity.js';
import type { OAuthClientRepository } from '../persistence/oauth-client.repository.js';
import type { OAuthRefreshTokenRepository } from '../persistence/oauth-refresh-token.repository.js';

@Injectable()
export class OAuthClientsService {
  constructor(
    @Inject('OAuthClientsRepository')
    private readonly clientRepository: OAuthClientRepository,
    @Inject('OAuthRefreshTokensRepository')
    private readonly refreshTokenRepository: OAuthRefreshTokenRepository,
    private readonly usersService: UsersService,
  ) {}

  async register(
    dto: RegisterOAuthClientDto,
  ): Promise<{ entity: OAuthClient; plainSecret: string }> {
    this.validateRedirectUris(dto.redirect_uris);

    const plainSecret = OAuthClientsService.generateSecret();
    const entity = await this.clientRepository.create({
      clientId: OAuthClientsService.generateClientId(),
      clientSecretHash: OAuthClientsService.hash(plainSecret),
      redirectUris: dto.redirect_uris,
      name: dto.client_name?.trim() || 'MCP client',
    });

    return { entity, plainSecret };
  }

  listClients(): Promise<OAuthClient[]> {
    return this.clientRepository.findAll();
  }

  async getByClientId(clientId: string | undefined): Promise<OAuthClient> {
    if (!clientId) {
      throw new OAuthInvalidRequestException('client_id is required');
    }
    const client = await this.clientRepository.findByClientId(clientId);
    if (!client) {
      throw new OAuthInvalidClientException();
    }
    return client;
  }

  async getById(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findById(id);
    if (!client) {
      throw new OAuthInvalidClientException();
    }
    return client;
  }

  verifySecret(client: OAuthClient, plainSecret: string | undefined): void {
    if (
      !plainSecret ||
      client.clientSecretHash !== OAuthClientsService.hash(plainSecret)
    ) {
      throw new OAuthInvalidClientException();
    }
  }

  async listWithActiveTokens(): Promise<
    Array<{
      client: OAuthClient;
      tokens: Array<{
        token: OAuthRefreshToken;
        user: { displayName: string; email: string };
      }>;
    }>
  > {
    const clients = await this.clientRepository.findAll();
    return Promise.all(
      clients.map(async (client) => {
        const tokens = await this.refreshTokenRepository.findActiveByClientId(
          client.id,
        );
        const enriched = await Promise.all(
          tokens.map(async (token) => ({
            token,
            user: await this.usersService.findById(token.userId),
          })),
        );
        return { client, tokens: enriched };
      }),
    );
  }

  async revokeToken(clientDbId: string, tokenId: string): Promise<void> {
    const token = await this.refreshTokenRepository.findById(tokenId);
    if (!token || token.clientId !== clientDbId || token.revokedAt !== null) {
      throw new OAuthRefreshTokenNotFoundException();
    }
    await this.refreshTokenRepository.revoke(tokenId);
  }

  private validateRedirectUris(redirectUris: unknown): void {
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      throw new OAuthInvalidRequestException(
        'redirect_uris must be a non-empty array',
      );
    }
    for (const uri of redirectUris) {
      if (
        typeof uri !== 'string' ||
        !OAuthClientsService.isValidRedirectUri(uri)
      ) {
        throw new OAuthInvalidRequestException(
          `Invalid redirect_uri: ${String(uri)}`,
        );
      }
    }
  }

  private static isValidRedirectUri(uri: string): boolean {
    try {
      const parsed = new URL(uri);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private static generateClientId(): string {
    return `${OAUTH_CLIENT_ID_PREFIX}${randomBytes(16).toString('hex')}`;
  }

  private static generateSecret(): string {
    return `${OAUTH_CLIENT_SECRET_PREFIX}${randomBytes(24).toString('hex')}`;
  }

  private static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
