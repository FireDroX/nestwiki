import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { CompromisedPasswordException } from '../../common/exceptions/auth/compromised-password.exception.js';
import { InvalidCredentialsException } from '../../common/exceptions/auth/invalid-credentials.exception.js';
import { InvalidRefreshTokenException } from '../../common/exceptions/auth/invalid-refresh-token.exception.js';
import { WeakPasswordException } from '../../common/exceptions/auth/weak-password.exception.js';
import { PwnedPasswordService } from '../../security/services/pwned-password.service.js';
import { TurnstileService } from '../../security/services/turnstile.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { AuthService } from './auth.service.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'irrelevant',
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

describe('AuthService.changePassword', () => {
  let service: AuthService;
  let usersService: {
    findById: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
  };
  let pwnedPasswordService: { checkPassword: ReturnType<typeof vi.fn> };
  let userActivityLogService: { record: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    usersService = {
      findById: vi.fn(),
      updatePassword: vi.fn(),
    };
    pwnedPasswordService = { checkPassword: vi.fn().mockResolvedValue(false) };
    userActivityLogService = { record: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        JwtService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn((key: string) => `${key}-test-secret`) },
        },
        { provide: TurnstileService, useValue: {} },
        { provide: PwnedPasswordService, useValue: pwnedPasswordService },
        { provide: UserActivityLogService, useValue: userActivityLogService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('throws InvalidCredentialsException when the current password is wrong', async () => {
    const passwordHash = await bcrypt.hash('CorrectPass1!', 10);
    usersService.findById.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'WrongPass1!',
        newPassword: 'NewValidPass1!',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('throws WeakPasswordException when the new password fails complexity rules', async () => {
    const passwordHash = await bcrypt.hash('CorrectPass1!', 10);
    usersService.findById.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'CorrectPass1!',
        newPassword: 'weak',
      }),
    ).rejects.toBeInstanceOf(WeakPasswordException);
    expect(usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('throws CompromisedPasswordException when the new password is pwned', async () => {
    const passwordHash = await bcrypt.hash('CorrectPass1!', 10);
    usersService.findById.mockResolvedValue(buildUser({ passwordHash }));
    pwnedPasswordService.checkPassword.mockResolvedValue(true);

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'CorrectPass1!',
        newPassword: 'NewValidPass1!',
      }),
    ).rejects.toBeInstanceOf(CompromisedPasswordException);
    expect(usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('hashes and persists the new password on success', async () => {
    const passwordHash = await bcrypt.hash('CorrectPass1!', 10);
    usersService.findById.mockResolvedValue(buildUser({ passwordHash }));
    usersService.updatePassword.mockResolvedValue(buildUser());

    await service.changePassword('user-1', {
      currentPassword: 'CorrectPass1!',
      newPassword: 'NewValidPass1!',
    });

    expect(usersService.updatePassword).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
    );
    const newHash = usersService.updatePassword.mock.calls[0][1] as string;
    await expect(bcrypt.compare('NewValidPass1!', newHash)).resolves.toBe(true);
  });

  it('issues a fresh session so the current device stays signed in', async () => {
    const passwordHash = await bcrypt.hash('CorrectPass1!', 10);
    usersService.findById.mockResolvedValue(buildUser({ passwordHash }));
    usersService.updatePassword.mockResolvedValue(
      buildUser({ passwordChangedAt: new Date() }),
    );

    const tokens = await service.changePassword('user-1', {
      currentPassword: 'CorrectPass1!',
      newPassword: 'NewValidPass1!',
    });

    const jwt = new JwtService();
    expect(
      jwt.verify(tokens.accessToken, {
        secret: 'JWT_ACCESS_SECRET-test-secret',
      }),
    ).toMatchObject({ sub: 'user-1', type: 'access' });
    expect(
      jwt.verify(tokens.refreshToken, {
        secret: 'JWT_REFRESH_SECRET-test-secret',
      }),
    ).toMatchObject({ sub: 'user-1', type: 'refresh' });
  });
});

describe('AuthService login and refresh', () => {
  const ACCESS_SECRET = 'JWT_ACCESS_SECRET-test-secret';
  const REFRESH_SECRET = 'JWT_REFRESH_SECRET-test-secret';
  let service: AuthService;
  let jwt: JwtService;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    resetFailedLoginAttempts: ReturnType<typeof vi.fn>;
    incrementFailedLoginAttempts: Mock<() => Promise<User>>;
    lockAccount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      resetFailedLoginAttempts: vi.fn().mockResolvedValue(undefined),
      incrementFailedLoginAttempts: vi
        .fn()
        .mockResolvedValue(buildUser({ failedLoginAttempts: 1 })),
      lockAccount: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { get: vi.fn((key: string) => `${key}-test-secret`) },
        },
        {
          provide: TurnstileService,
          useValue: { verify: vi.fn().mockResolvedValue(true) },
        },
        { provide: PwnedPasswordService, useValue: {} },
        {
          provide: UserActivityLogService,
          useValue: { record: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  describe('account lockout', () => {
    it('starts over from zero once the lock has expired', async () => {
      usersService.findByEmail.mockResolvedValue(
        buildUser({
          passwordHash: await bcrypt.hash('CorrectPass1!', 4),
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() - 1000),
        }),
      );
      usersService.incrementFailedLoginAttempts.mockImplementation(() =>
        Promise.resolve(
          buildUser({
            failedLoginAttempts:
              usersService.resetFailedLoginAttempts.mock.calls.length > 0
                ? 1
                : 6,
          }),
        ),
      );

      await expect(
        service.login(
          {
            email: 'user@example.com',
            password: 'WrongPass1!',
            turnstileToken: 'token',
          },
          '203.0.113.9',
        ),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(usersService.resetFailedLoginAttempts).toHaveBeenCalledWith(
        'user-1',
      );
      expect(usersService.lockAccount).not.toHaveBeenCalled();
    });

    it('still locks after five failures in a row', async () => {
      usersService.findByEmail.mockResolvedValue(
        buildUser({
          passwordHash: await bcrypt.hash('CorrectPass1!', 4),
          failedLoginAttempts: 4,
        }),
      );
      usersService.incrementFailedLoginAttempts.mockResolvedValue(
        buildUser({ failedLoginAttempts: 5 }),
      );

      await expect(
        service.login(
          {
            email: 'user@example.com',
            password: 'WrongPass1!',
            turnstileToken: 'token',
          },
          '203.0.113.9',
        ),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(usersService.lockAccount).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const payload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'member',
    };

    beforeEach(() => {
      usersService.findById.mockResolvedValue(buildUser());
    });

    it('issues a typed access token', async () => {
      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        { secret: REFRESH_SECRET },
      );

      const { accessToken } = await service.refresh(refreshToken);

      expect(jwt.verify(accessToken, { secret: ACCESS_SECRET })).toMatchObject({
        type: 'access',
        sub: 'user-1',
      });
    });

    it('still accepts a refresh token issued before tokens were typed', async () => {
      const refreshToken = jwt.sign(payload, { secret: REFRESH_SECRET });

      const { accessToken } = await service.refresh(refreshToken);

      expect(typeof accessToken).toBe('string');
    });

    it('rejects any other kind of token signed with the refresh secret', async () => {
      const accessToken = jwt.sign(
        { ...payload, type: 'access' },
        { secret: REFRESH_SECRET },
      );

      await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
    });

    it('rejects a refresh token issued before the last password change', async () => {
      const refreshToken = jwt.sign(
        {
          ...payload,
          type: 'refresh',
          iat: Math.floor(Date.now() / 1000) - 60,
        },
        { secret: REFRESH_SECRET },
      );
      usersService.findById.mockResolvedValue(
        buildUser({ passwordChangedAt: new Date() }),
      );

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
    });
  });
});
