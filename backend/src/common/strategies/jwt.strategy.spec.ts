import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../users/entities/user.entity.js';
import type { UserRepository } from '../../users/persistence/user.repository.js';
import { SessionUserResolver } from '../services/session-user.resolver.js';
import { JwtStrategy } from './jwt.strategy.js';

const SECRET = 'access-secret-for-tests-access-secret';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    displayName: 'User One',
    avatarExtension: null,
    role: 'member',
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('JwtStrategy', () => {
  let findById: ReturnType<typeof vi.fn>;
  let strategy: JwtStrategy;
  let resolver: SessionUserResolver;
  const jwtService = new JwtService();
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(buildUser());
    const config = { get: vi.fn().mockReturnValue(SECRET) };
    resolver = new SessionUserResolver(
      { findById } as unknown as UserRepository,
      jwtService,
      config as unknown as ConfigService,
    );
    strategy = new JwtStrategy(config as unknown as ConfigService, resolver);
  });

  it('rejects an OAuth MCP access token presented as a session', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        clientId: 'client-1',
        scopes: [],
        type: 'mcp_oauth_access',
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects an untyped token', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'member',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a deactivated user whose token still claims admin', async () => {
    findById.mockResolvedValue(buildUser({ role: 'member', isActive: false }));

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'admin',
        type: 'access',
        iat: nowSeconds(),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('takes the role from the database, not from the token', async () => {
    findById.mockResolvedValue(buildUser({ role: 'member' }));

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'admin',
        type: 'access',
        iat: nowSeconds(),
      }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
      role: 'member',
    });
  });

  it('rejects a deleted user', async () => {
    findById.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'member',
        type: 'access',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a session opened before the last password change', async () => {
    findById.mockResolvedValue(buildUser({ passwordChangedAt: new Date() }));

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'member',
        type: 'access',
        iat: nowSeconds() - 60,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps a session issued in the same second as the password change', async () => {
    const changedAt = new Date(Math.ceil(Date.now() / 1000) * 1000);
    findById.mockResolvedValue(buildUser({ passwordChangedAt: changedAt }));

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'member',
        type: 'access',
        iat: changedAt.getTime() / 1000 - 1,
      }),
    ).resolves.toMatchObject({ id: 'user-1' });
  });

  describe('SessionUserResolver.verify', () => {
    it('returns the user and the expiry of a valid session token', async () => {
      const token = jwtService.sign(
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: 'member',
          type: 'access',
        },
        { secret: SECRET, expiresIn: 60 },
      );

      const session = await resolver.verify(token);

      expect(session?.user).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: 'member',
      });
      expect(session?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('returns null for a forged or foreign token', async () => {
      const forged = jwtService.sign(
        { sub: 'user-1', type: 'access' },
        { secret: 'another-secret-another-secret-123' },
      );
      const oauth = jwtService.sign(
        { sub: 'user-1', type: 'mcp_oauth_access' },
        { secret: SECRET },
      );

      expect(await resolver.verify(forged)).toBeNull();
      expect(await resolver.verify(oauth)).toBeNull();
    });
  });
});
