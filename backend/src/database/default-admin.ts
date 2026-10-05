import * as bcrypt from 'bcryptjs';
import { DefaultAdminConfigurationException } from '../common/exceptions/config/default-admin-configuration.exception.js';
import { DefaultAdminEmailTakenException } from '../common/exceptions/config/default-admin-email-taken.exception.js';
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_REGEX,
  KNOWN_DEFAULT_SECRETS,
  MIN_PASSWORD_LENGTH,
  PASSWORD_COMPLEXITY_REGEX,
} from '../common/variables.global.js';
import type { UserRole } from '../users/entities/user.entity.js';

const SALT_ROUNDS = 10;

export interface DefaultAdminSettings {
  email?: string;
  password?: string;
  displayName?: string;
}

export interface NewDefaultAdmin {
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface DefaultAdminStore {
  countAdmins(): Promise<number>;
  findByEmail(email: string): Promise<{ role: UserRole } | null>;
  createAdmin(admin: NewDefaultAdmin): Promise<void>;
}

export type DefaultAdminOutcome = 'created' | 'already-present';

function presentValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function defaultAdminSettingsFromEnv(
  env: Record<string, string | undefined>,
): DefaultAdminSettings {
  return {
    email: presentValue(env.ADMIN_EMAIL),
    password: presentValue(env.ADMIN_PASSWORD) ? env.ADMIN_PASSWORD : undefined,
    displayName: presentValue(env.ADMIN_DISPLAY_NAME),
  };
}

function emailProblems(email: string | undefined): string[] {
  if (!email) {
    return ['ADMIN_EMAIL: is required'];
  }
  return EMAIL_REGEX.test(email)
    ? []
    : ['ADMIN_EMAIL: must be a valid email address'];
}

function passwordProblems(password: string | undefined): string[] {
  if (!password) {
    return ['ADMIN_PASSWORD: is required'];
  }
  if (KNOWN_DEFAULT_SECRETS.includes(password.trim().toLowerCase())) {
    return ['ADMIN_PASSWORD: uses a well-known default value'];
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return [
      `ADMIN_PASSWORD: must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    ];
  }
  return PASSWORD_COMPLEXITY_REGEX.test(password)
    ? []
    : [
        'ADMIN_PASSWORD: must contain an uppercase letter, a digit and a symbol',
      ];
}

function displayNameProblems(displayName: string | undefined): string[] {
  if (!displayName) {
    return ['ADMIN_DISPLAY_NAME: is required'];
  }
  const withinBounds =
    displayName.length >= DISPLAY_NAME_MIN_LENGTH &&
    displayName.length <= DISPLAY_NAME_MAX_LENGTH;
  return withinBounds
    ? []
    : [
        `ADMIN_DISPLAY_NAME: must be between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters`,
      ];
}

export async function ensureDefaultAdmin(
  store: DefaultAdminStore,
  settings: DefaultAdminSettings,
): Promise<DefaultAdminOutcome> {
  if ((await store.countAdmins()) > 0) {
    return 'already-present';
  }

  const problems = [
    ...emailProblems(settings.email),
    ...passwordProblems(settings.password),
    ...displayNameProblems(settings.displayName),
  ];
  if (problems.length > 0) {
    throw new DefaultAdminConfigurationException(problems);
  }

  const email = settings.email!;
  if (await store.findByEmail(email)) {
    throw new DefaultAdminEmailTakenException();
  }

  await store.createAdmin({
    email,
    passwordHash: await bcrypt.hash(settings.password!, SALT_ROUNDS),
    displayName: settings.displayName!,
  });
  return 'created';
}
