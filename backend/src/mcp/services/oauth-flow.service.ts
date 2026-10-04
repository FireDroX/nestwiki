import { randomBytes, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuthInvalidGrantException } from '../../common/exceptions/mcp/oauth-invalid-grant.exception.js';
import { OAuthInvalidRequestException } from '../../common/exceptions/mcp/oauth-invalid-request.exception.js';
import {
  MCP_SCOPES,
  OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
  OAUTH_AUTHORIZATION_CODE_EXPIRY_SECONDS,
  OAUTH_AUTHORIZATION_CODE_PREFIX,
  OAUTH_REFRESH_TOKEN_EXPIRY_DAYS,
  OAUTH_REFRESH_TOKEN_PREFIX,
} from '../../common/variables.global.js';
import { OAuthClient } from '../entities/oauth-client.entity.js';
import type { OAuthRefreshTokenRepository } from '../persistence/oauth-refresh-token.repository.js';

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface PendingAuthorizationCode {
  clientDbId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

export interface OAuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
}

export interface OAuthAccessTokenPayload {
  sub: string;
  clientId: string;
  scopes: string[];
  type: 'mcp_oauth_access';
}

@Injectable()
export class OAuthFlowService {
  private readonly pendingCodes = new Map<string, PendingAuthorizationCode>();

  constructor(
    @Inject('OAuthRefreshTokensRepository')
    private readonly refreshTokenRepository: OAuthRefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  createAuthorizationCode(input: {
    clientDbId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
  }): string {
    const code = `${OAUTH_AUTHORIZATION_CODE_PREFIX}${randomBytes(24).toString('hex')}`;
    this.pendingCodes.set(code, {
      ...input,
      expiresAt:
        Date.now() + OAUTH_AUTHORIZATION_CODE_EXPIRY_SECONDS * MS_PER_SECOND,
    });
    return code;
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    client: OAuthClient;
    redirectUri: string;
  }): Promise<OAuthTokenPair> {
    const pending = this.pendingCodes.get(input.code);
    if (pending) {
      this.pendingCodes.delete(input.code);
    }

    if (
      !pending ||
      pending.expiresAt < Date.now() ||
      pending.clientDbId !== input.client.id ||
      pending.redirectUri !== input.redirectUri ||
      !OAuthFlowService.verifyPkce(input.codeVerifier, pending.codeChallenge)
    ) {
      throw new OAuthInvalidGrantException();
    }

    return this.issueTokenPair(input.client, pending.userId);
  }

  async refresh(input: {
    client: OAuthClient;
    refreshToken: string;
  }): Promise<OAuthTokenPair> {
    const stored = await this.refreshTokenRepository.findByTokenHash(
      OAuthFlowService.hash(input.refreshToken),
    );
    if (
      !stored ||
      stored.clientId !== input.client.id ||
      stored.revokedAt !== null ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new OAuthInvalidGrantException();
    }

    await this.refreshTokenRepository.revoke(stored.id);
    return this.issueTokenPair(input.client, stored.userId);
  }

  async revoke(
    refreshToken: string | undefined,
  ): Promise<{ userId: string } | null> {
    if (!refreshToken) {
      throw new OAuthInvalidRequestException('token is required');
    }
    const stored = await this.refreshTokenRepository.findByTokenHash(
      OAuthFlowService.hash(refreshToken),
    );
    if (!stored || stored.revokedAt !== null) {
      return null;
    }
    await this.refreshTokenRepository.revoke(stored.id);
    return { userId: stored.userId };
  }

  private async issueTokenPair(
    client: OAuthClient,
    userId: string,
  ): Promise<OAuthTokenPair> {
    const scopes = [...MCP_SCOPES];
    const payload: OAuthAccessTokenPayload = {
      sub: userId,
      clientId: client.id,
      scopes,
      type: 'mcp_oauth_access',
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
    });

    const plainRefreshToken = `${OAUTH_REFRESH_TOKEN_PREFIX}${randomBytes(32).toString('hex')}`;
    await this.refreshTokenRepository.create({
      tokenHash: OAuthFlowService.hash(plainRefreshToken),
      clientId: client.id,
      userId,
      scopes,
      expiresAt: new Date(
        Date.now() + OAUTH_REFRESH_TOKEN_EXPIRY_DAYS * MS_PER_DAY,
      ),
    });

    return {
      accessToken,
      refreshToken: plainRefreshToken,
      expiresIn: OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
      scopes,
    };
  }

  private static verifyPkce(
    codeVerifier: string,
    codeChallenge: string,
  ): boolean {
    const computed = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return computed === codeChallenge;
  }

  private static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
