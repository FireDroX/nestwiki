import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { CompromisedPasswordException } from '../../common/exceptions/auth/compromised-password.exception.js';
import { InvalidCredentialsException } from '../../common/exceptions/auth/invalid-credentials.exception.js';
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
    avatarUrl: null,
    role: 'reader',
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
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
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: vi.fn() } },
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
});
