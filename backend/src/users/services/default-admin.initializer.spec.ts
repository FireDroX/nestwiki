import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CreateUserDto } from '../dto/in/create-user.dto.js';
import { DefaultAdminConfigurationException } from '../../common/exceptions/config/default-admin-configuration.exception.js';
import { DefaultAdminInitializer } from './default-admin.initializer.js';

const ENV: Record<string, string> = {
  ADMIN_EMAIL: 'owner@example.com',
  ADMIN_PASSWORD: 'Str0ng!Passphrase',
  ADMIN_DISPLAY_NAME: 'Wiki Owner',
};

describe('DefaultAdminInitializer', () => {
  let usersRepository: {
    countAdmins: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: Mock<(data: CreateUserDto) => Promise<void>>;
  };
  let env: Record<string, string>;

  async function buildInitializer(): Promise<DefaultAdminInitializer> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefaultAdminInitializer,
        { provide: 'UsersRepository', useValue: usersRepository },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();
    return moduleRef.get(DefaultAdminInitializer);
  }

  beforeEach(() => {
    usersRepository = {
      countAdmins: vi.fn().mockResolvedValue(0),
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi
        .fn<(data: CreateUserDto) => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    env = { ...ENV };
  });

  it('creates the admin with the admin role on bootstrap when none exists', async () => {
    const initializer = await buildInitializer();

    await initializer.onApplicationBootstrap();

    expect(usersRepository.create).toHaveBeenCalledTimes(1);
    const created = usersRepository.create.mock.calls[0][0];
    expect(created).toMatchObject({
      email: 'owner@example.com',
      displayName: 'Wiki Owner',
      role: 'admin',
    });
    expect(await bcrypt.compare(ENV.ADMIN_PASSWORD, created.passwordHash)).toBe(
      true,
    );
  });

  it('leaves the users untouched when an admin already exists', async () => {
    usersRepository.countAdmins.mockResolvedValue(2);
    const initializer = await buildInitializer();

    await initializer.onApplicationBootstrap();

    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('makes the application fail to start when no admin exists and ADMIN_* is missing', async () => {
    env = {};
    const initializer = await buildInitializer();

    await expect(initializer.onApplicationBootstrap()).rejects.toBeInstanceOf(
      DefaultAdminConfigurationException,
    );
  });
});
