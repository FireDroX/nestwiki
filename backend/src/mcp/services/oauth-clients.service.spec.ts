import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthInvalidClientException } from '../../common/exceptions/mcp/oauth-invalid-client.exception.js';
import { OAuthInvalidRequestException } from '../../common/exceptions/mcp/oauth-invalid-request.exception.js';
import { UsersService } from '../../users/services/users.service.js';
import { RegisterOAuthClientDto } from '../dto/in/register-oauth-client.dto.js';
import { OAuthClient } from '../entities/oauth-client.entity.js';
import { OAuthClientsService } from './oauth-clients.service.js';

const client: OAuthClient = {
  id: 'client-db-1',
  clientId: 'oauth_client_abc',
  clientSecretHash: createHash('sha256').update('secret').digest('hex'),
  redirectUris: ['https://client.example.com/callback'],
  name: 'Test client',
  createdAt: new Date(),
};

describe('OAuthClientsService', () => {
  let service: OAuthClientsService;
  let findByClientId: ReturnType<typeof vi.fn>;
  let clientRepository: {
    findByClientId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteWithoutTokensCreatedBefore: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    findByClientId = vi.fn().mockResolvedValue(client);
    clientRepository = {
      findByClientId,
      create: vi.fn((data: Partial<OAuthClient>) =>
        Promise.resolve({ ...client, ...data }),
      ),
      deleteWithoutTokensCreatedBefore: vi.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OAuthClientsService,
        { provide: 'OAuthClientsRepository', useValue: clientRepository },
        { provide: 'OAuthRefreshTokensRepository', useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(OAuthClientsService);
  });

  describe('register', () => {
    it('registers a client with https and loopback redirect URIs', async () => {
      const { entity } = await service.register({
        redirect_uris: [
          'https://claude.ai/api/mcp/auth_callback',
          'http://localhost:6274/oauth/callback',
          'http://127.0.0.1:33418/callback',
        ],
        client_name: 'Claude',
      });

      expect(entity.name).toBe('Claude');
      expect(clientRepository.create).toHaveBeenCalled();
    });

    it('purges the clients that never obtained a token before registering', async () => {
      await service.register({
        redirect_uris: ['https://client.example.com/callback'],
      });

      const cutoff = clientRepository.deleteWithoutTokensCreatedBefore.mock
        .calls[0][0] as Date;
      expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
        24 * 3_600_000 - 1000,
      );
    });

    it.each([
      [
        'too many redirect URIs',
        { redirect_uris: Array(10_000).fill('https://a.example/cb') },
      ],
      [
        'a redirect URI that is too long',
        { redirect_uris: [`https://a.example/${'x'.repeat(2048)}`] },
      ],
      [
        'a plain-http redirect to a remote host',
        { redirect_uris: ['http://attacker.example/cb'] },
      ],
      [
        'a client_name that is too long',
        {
          redirect_uris: ['https://a.example/cb'],
          client_name: 'x'.repeat(256),
        },
      ],
      [
        'a client_name that is not a string',
        {
          redirect_uris: ['https://a.example/cb'],
          client_name: { evil: true },
        },
      ],
    ])('rejects %s', async (_case, dto) => {
      await expect(
        service.register(dto as unknown as RegisterOAuthClientDto),
      ).rejects.toBeInstanceOf(OAuthInvalidRequestException);
      expect(clientRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getByClientId', () => {
    it('rejects a missing client_id as invalid_request without querying the database', async () => {
      await expect(service.getByClientId(undefined)).rejects.toBeInstanceOf(
        OAuthInvalidRequestException,
      );
      expect(findByClientId).not.toHaveBeenCalled();
    });

    it('rejects an unknown client as invalid_client', async () => {
      findByClientId.mockResolvedValue(null);

      await expect(service.getByClientId('unknown')).rejects.toBeInstanceOf(
        OAuthInvalidClientException,
      );
    });

    it('returns a known client', async () => {
      expect(await service.getByClientId('oauth_client_abc')).toBe(client);
    });
  });

  describe('verifySecret', () => {
    it('rejects a missing secret as invalid_client', () => {
      expect(() => service.verifySecret(client, undefined)).toThrow(
        OAuthInvalidClientException,
      );
    });

    it('rejects a wrong secret', () => {
      expect(() => service.verifySecret(client, 'wrong')).toThrow(
        OAuthInvalidClientException,
      );
    });

    it('accepts the right secret', () => {
      expect(() => service.verifySecret(client, 'secret')).not.toThrow();
    });
  });
});
