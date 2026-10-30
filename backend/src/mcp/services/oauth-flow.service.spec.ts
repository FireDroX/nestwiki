import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthInvalidGrantException } from '../../common/exceptions/mcp/oauth-invalid-grant.exception.js';
import { OAuthInvalidRequestException } from '../../common/exceptions/mcp/oauth-invalid-request.exception.js';
import { MCP_SCOPES } from '../../common/variables.global.js';
import { UsersService } from '../../users/services/users.service.js';
import { OAuthClient } from '../entities/oauth-client.entity.js';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity.js';
import { OAuthFlowService } from './oauth-flow.service.js';

function buildClient(overrides: Partial<OAuthClient> = {}): OAuthClient {
  return {
    id: 'client-db-1',
    clientId: 'oauth_client_abc',
    clientSecretHash: 'irrelevant',
    redirectUris: ['https://client.example.com/callback'],
    name: 'Test client',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildRefreshToken(
  overrides: Partial<OAuthRefreshToken> = {},
): OAuthRefreshToken {
  return {
    id: 'token-1',
    tokenHash: 'irrelevant',
    clientId: 'client-db-1',
    userId: 'user-1',
    scopes: ['pages:read'],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const CODE_VERIFIER = 'a'.repeat(64);
const CODE_CHALLENGE = createHash('sha256')
  .update(CODE_VERIFIER)
  .digest('base64url');

describe('OAuthFlowService', () => {
  let service: OAuthFlowService;
  let usersService: { findById: ReturnType<typeof vi.fn> };
  let refreshTokenRepository: {
    create: ReturnType<typeof vi.fn>;
    findByTokenHash: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findActiveByClientId: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    refreshTokenRepository = {
      create: vi.fn().mockResolvedValue(buildRefreshToken()),
      findByTokenHash: vi.fn(),
      findById: vi.fn(),
      findActiveByClientId: vi.fn(),
      revoke: vi.fn().mockResolvedValue(undefined),
    };

    usersService = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        role: 'admin',
        isActive: true,
        passwordChangedAt: null,
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        OAuthFlowService,
        { provide: UsersService, useValue: usersService },
        {
          provide: 'OAuthRefreshTokensRepository',
          useValue: refreshTokenRepository,
        },
        JwtService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get(OAuthFlowService);
  });

  describe('exchangeAuthorizationCode', () => {
    it('issues a token pair when the code_verifier matches the stored code_challenge', async () => {
      const client = buildClient();
      const code = service.createAuthorizationCode({
        clientDbId: client.id,
        userId: 'user-1',
        redirectUri: client.redirectUris[0],
        codeChallenge: CODE_CHALLENGE,
        scopes: ['pages:read'],
      });

      const result = await service.exchangeAuthorizationCode({
        code,
        codeVerifier: CODE_VERIFIER,
        client,
        redirectUri: client.redirectUris[0],
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: client.id,
          userId: 'user-1',
          scopes: ['pages:read'],
        }),
      );
      expect(result.scopes).toEqual(['pages:read']);
    });

    it('rejects a mismatched code_verifier', async () => {
      const client = buildClient();
      const code = service.createAuthorizationCode({
        clientDbId: client.id,
        userId: 'user-1',
        redirectUri: client.redirectUris[0],
        codeChallenge: CODE_CHALLENGE,
        scopes: ['pages:read'],
      });

      await expect(
        service.exchangeAuthorizationCode({
          code,
          codeVerifier: 'wrong-verifier',
          client,
          redirectUri: client.redirectUris[0],
        }),
      ).rejects.toThrow('Invalid, expired or already used grant');
    });

    it('rejects reuse of an already-exchanged code', async () => {
      const client = buildClient();
      const code = service.createAuthorizationCode({
        clientDbId: client.id,
        userId: 'user-1',
        redirectUri: client.redirectUris[0],
        codeChallenge: CODE_CHALLENGE,
        scopes: ['pages:read'],
      });

      await service.exchangeAuthorizationCode({
        code,
        codeVerifier: CODE_VERIFIER,
        client,
        redirectUri: client.redirectUris[0],
      });

      await expect(
        service.exchangeAuthorizationCode({
          code,
          codeVerifier: CODE_VERIFIER,
          client,
          redirectUri: client.redirectUris[0],
        }),
      ).rejects.toThrow('Invalid, expired or already used grant');
    });

    it('rejects a code issued for a different client', async () => {
      const client = buildClient();
      const otherClient = buildClient({ id: 'client-db-2' });
      const code = service.createAuthorizationCode({
        clientDbId: client.id,
        userId: 'user-1',
        redirectUri: client.redirectUris[0],
        codeChallenge: CODE_CHALLENGE,
        scopes: ['pages:read'],
      });

      await expect(
        service.exchangeAuthorizationCode({
          code,
          codeVerifier: CODE_VERIFIER,
          client: otherClient,
          redirectUri: client.redirectUris[0],
        }),
      ).rejects.toThrow('Invalid, expired or already used grant');
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const client = buildClient();
      const stored = buildRefreshToken({ clientId: client.id });
      refreshTokenRepository.findByTokenHash.mockResolvedValue(stored);

      const result = await service.refresh({
        client,
        refreshToken: 'oauth_rt_plain',
      });

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(stored.id);
      expect(result.refreshToken).not.toEqual('oauth_rt_plain');
      expect(result.scopes).toEqual(stored.scopes);
    });

    it('rejects a refresh token granted before the last password change', async () => {
      const client = buildClient();
      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        buildRefreshToken({
          clientId: client.id,
          createdAt: new Date(Date.now() - 60_000),
        }),
      );
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
        isActive: true,
        passwordChangedAt: new Date(),
      });

      await expect(
        service.refresh({ client, refreshToken: 'oauth_rt_plain' }),
      ).rejects.toBeInstanceOf(OAuthInvalidGrantException);
      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a refresh token of a user who is no longer an active admin', async () => {
      const client = buildClient();
      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        buildRefreshToken({ clientId: client.id }),
      );
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        role: 'member',
        isActive: true,
        passwordChangedAt: null,
      });

      await expect(
        service.refresh({ client, refreshToken: 'oauth_rt_plain' }),
      ).rejects.toBeInstanceOf(OAuthInvalidGrantException);
    });

    it('rejects a revoked refresh token', async () => {
      const client = buildClient();
      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        buildRefreshToken({ clientId: client.id, revokedAt: new Date() }),
      );

      await expect(
        service.refresh({ client, refreshToken: 'oauth_rt_plain' }),
      ).rejects.toThrow('Invalid, expired or already used grant');
    });

    it('rejects a refresh token that belongs to another client', async () => {
      const client = buildClient();
      refreshTokenRepository.findByTokenHash.mockResolvedValue(
        buildRefreshToken({ clientId: 'another-client-db-id' }),
      );

      await expect(
        service.refresh({ client, refreshToken: 'oauth_rt_plain' }),
      ).rejects.toThrow('Invalid, expired or already used grant');
    });
  });

  describe('resolveScopes', () => {
    it('grants every scope when the client asks for none', () => {
      expect(OAuthFlowService.resolveScopes(undefined)).toEqual(MCP_SCOPES);
    });

    it('keeps only the requested scopes, in canonical order', () => {
      expect(
        OAuthFlowService.resolveScopes('search:read  pages:read pages:read'),
      ).toEqual(['pages:read', 'search:read']);
    });

    it('rejects an unknown scope', () => {
      expect(() => OAuthFlowService.resolveScopes('pages:read admin')).toThrow(
        OAuthInvalidRequestException,
      );
    });
  });

  describe('revoke', () => {
    it('revokes a known active token and returns its owner', async () => {
      const stored = buildRefreshToken();
      refreshTokenRepository.findByTokenHash.mockResolvedValue(stored);

      const result = await service.revoke('oauth_rt_plain');

      expect(result).toEqual({ userId: stored.userId });
      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(stored.id);
    });

    it('rejects a request without token as invalid_request', async () => {
      await expect(service.revoke(undefined)).rejects.toBeInstanceOf(
        OAuthInvalidRequestException,
      );
      expect(refreshTokenRepository.findByTokenHash).not.toHaveBeenCalled();
    });

    it('is a no-op for an unknown token', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      const result = await service.revoke('unknown');

      expect(result).toBeNull();
      expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
    });
  });
});
