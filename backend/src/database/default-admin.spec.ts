import * as bcrypt from 'bcryptjs';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { DefaultAdminConfigurationException } from '../common/exceptions/config/default-admin-configuration.exception.js';
import { DefaultAdminEmailTakenException } from '../common/exceptions/config/default-admin-email-taken.exception.js';
import {
  defaultAdminSettingsFromEnv,
  ensureDefaultAdmin,
  type DefaultAdminSettings,
  type DefaultAdminStore,
} from './default-admin.js';

const SETTINGS: DefaultAdminSettings = {
  email: 'owner@example.com',
  password: 'Str0ng!Passphrase',
  displayName: 'Wiki Owner',
};

type StoreMock = {
  [Key in keyof DefaultAdminStore]: Mock<DefaultAdminStore[Key]>;
};

function storeWith(
  adminCount: number,
  existingRole: 'admin' | 'member' | null = null,
): StoreMock {
  return {
    countAdmins: vi.fn(() => Promise.resolve(adminCount)),
    findByEmail: vi.fn(() =>
      Promise.resolve(existingRole ? { role: existingRole } : null),
    ),
    createAdmin: vi.fn(() => Promise.resolve()),
  };
}

describe('ensureDefaultAdmin', () => {
  it('creates the admin from the settings when no admin exists, with a hashed password', async () => {
    const store = storeWith(0);

    const outcome = await ensureDefaultAdmin(store, SETTINGS);

    expect(outcome).toBe('created');
    expect(store.createAdmin).toHaveBeenCalledTimes(1);
    const created = store.createAdmin.mock.calls[0][0];
    expect(created.email).toBe('owner@example.com');
    expect(created.displayName).toBe('Wiki Owner');
    expect(created.passwordHash).not.toBe(SETTINGS.password);
    expect(await bcrypt.compare(SETTINGS.password!, created.passwordHash)).toBe(
      true,
    );
  });

  it('does nothing when an admin already exists, even without settings', async () => {
    const store = storeWith(1);

    const outcome = await ensureDefaultAdmin(store, {});

    expect(outcome).toBe('already-present');
    expect(store.createAdmin).not.toHaveBeenCalled();
  });

  it('refuses to start when no admin exists and the settings are missing', async () => {
    const store = storeWith(0);

    await expect(ensureDefaultAdmin(store, {})).rejects.toMatchObject({
      name: 'DefaultAdminConfigurationException',
      problems: [
        'ADMIN_EMAIL: is required',
        'ADMIN_PASSWORD: is required',
        'ADMIN_DISPLAY_NAME: is required',
      ],
    });
    expect(store.createAdmin).not.toHaveBeenCalled();
  });

  it('reports every invalid setting at once', async () => {
    const store = storeWith(0);

    const error = await ensureDefaultAdmin(store, {
      email: 'not-an-email',
      password: 'alllowercase',
      displayName: 'X',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DefaultAdminConfigurationException);
    expect((error as DefaultAdminConfigurationException).problems).toEqual([
      'ADMIN_EMAIL: must be a valid email address',
      'ADMIN_PASSWORD: must contain an uppercase letter, a digit and a symbol',
      'ADMIN_DISPLAY_NAME: must be between 2 and 100 characters',
    ]);
  });

  it('rejects a well-known default password', async () => {
    await expect(
      ensureDefaultAdmin(storeWith(0), { ...SETTINGS, password: 'ChangeMe' }),
    ).rejects.toMatchObject({
      problems: ['ADMIN_PASSWORD: uses a well-known default value'],
    });
  });

  it('refuses to silently promote an existing member who owns the email', async () => {
    const store = storeWith(0, 'member');

    await expect(ensureDefaultAdmin(store, SETTINGS)).rejects.toBeInstanceOf(
      DefaultAdminEmailTakenException,
    );
    expect(store.createAdmin).not.toHaveBeenCalled();
  });

  it('never puts the password in an error message', async () => {
    const error = (await ensureDefaultAdmin(storeWith(0), {
      ...SETTINGS,
      email: 'broken',
    }).catch((caught: unknown) => caught)) as Error;

    expect(error.message).not.toContain(SETTINGS.password);
  });
});

describe('defaultAdminSettingsFromEnv', () => {
  it('reads and trims the ADMIN_* variables, treating blank values as missing', () => {
    expect(
      defaultAdminSettingsFromEnv({
        ADMIN_EMAIL: ' owner@example.com ',
        ADMIN_PASSWORD: 'Str0ng!Passphrase',
        ADMIN_DISPLAY_NAME: '   ',
      }),
    ).toEqual({
      email: 'owner@example.com',
      password: 'Str0ng!Passphrase',
      displayName: undefined,
    });
  });
});
