import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthInvalidClientException } from '../../common/exceptions/mcp/oauth-invalid-client.exception.js';
import { OAuthInvalidRequestException } from '../../common/exceptions/mcp/oauth-invalid-request.exception.js';
import { UsersService } from '../../users/services/users.service.js';
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

  beforeEach(async () => {
    findByClientId = vi.fn().mockResolvedValue(client);
    const moduleRef = await Test.createTestingModule({
      providers: [
        OAuthClientsService,
        { provide: 'OAuthClientsRepository', useValue: { findByClientId } },
        { provide: 'OAuthRefreshTokensRepository', useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(OAuthClientsService);
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
