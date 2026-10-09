import { describe, expect, it } from 'vitest';
import { InvalidEnvironmentException } from '../common/exceptions/config/invalid-environment.exception.js';
import { validateEnvironment } from './env.validation.js';

const STRONG_ACCESS = 'a'.repeat(16) + 'b'.repeat(16);
const STRONG_REFRESH = 'c'.repeat(16) + 'd'.repeat(16);

function validConfig(): Record<string, unknown> {
  return {
    JWT_ACCESS_SECRET: STRONG_ACCESS,
    JWT_REFRESH_SECRET: STRONG_REFRESH,
    DB_PASSWORD: 'db-password-from-a-vault',
    MINIO_SECRET_KEY: 'storage-secret-from-a-vault',
  };
}

function problemsFor(config: Record<string, unknown>): string[] {
  try {
    validateEnvironment(config);
  } catch (error) {
    if (error instanceof InvalidEnvironmentException) {
      return error.problems;
    }
    throw error;
  }
  return [];
}

describe('validateEnvironment', () => {
  it('returns the configuration untouched when every secret is acceptable', () => {
    const config = { ...validConfig(), PORT: '3000' };

    expect(validateEnvironment(config)).toBe(config);
  });

  it.each([
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_PASSWORD',
    'MINIO_SECRET_KEY',
  ])('rejects a missing %s', (key) => {
    const config = validConfig();
    delete config[key];

    expect(problemsFor(config)).toEqual([`${key}: is required`]);
  });

  it('treats a blank value as missing', () => {
    expect(problemsFor({ ...validConfig(), DB_PASSWORD: '   ' })).toEqual([
      'DB_PASSWORD: is required',
    ]);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(
      problemsFor({ ...validConfig(), JWT_ACCESS_SECRET: 'x'.repeat(31) }),
    ).toEqual(['JWT_ACCESS_SECRET: must be at least 32 characters long']);
  });

  it.each(['changeme', 'minioadmin', 'root', 'ci-access-secret'])(
    'rejects the known default value "%s"',
    (value) => {
      expect(
        problemsFor({ ...validConfig(), MINIO_SECRET_KEY: value }),
      ).toEqual(['MINIO_SECRET_KEY: uses a well-known default value']);
    },
  );

  it('matches known default values regardless of case and surrounding spaces', () => {
    expect(
      problemsFor({ ...validConfig(), DB_PASSWORD: ' ChangeMe ' }),
    ).toEqual(['DB_PASSWORD: uses a well-known default value']);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(
      problemsFor({ ...validConfig(), JWT_REFRESH_SECRET: STRONG_ACCESS }),
    ).toEqual(['JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET']);
  });

  it('accepts a missing ADMIN_PASSWORD', () => {
    expect(problemsFor(validConfig())).toEqual([]);
  });

  it('rejects an ADMIN_PASSWORD that is too short or a known default', () => {
    expect(problemsFor({ ...validConfig(), ADMIN_PASSWORD: 'Ab1!' })).toEqual([
      'ADMIN_PASSWORD: must be at least 8 characters long',
    ]);
    expect(
      problemsFor({ ...validConfig(), ADMIN_PASSWORD: 'password123' }),
    ).toEqual(['ADMIN_PASSWORD: uses a well-known default value']);
  });

  it('reports every problem at once', () => {
    expect(
      problemsFor({
        JWT_ACCESS_SECRET: 'changeme',
        JWT_REFRESH_SECRET: 'changeme',
        DB_PASSWORD: 'changeme',
      }),
    ).toEqual([
      'JWT_ACCESS_SECRET: uses a well-known default value',
      'JWT_REFRESH_SECRET: uses a well-known default value',
      'JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET',
      'DB_PASSWORD: uses a well-known default value',
      'MINIO_SECRET_KEY: is required',
    ]);
  });

  it.each(['true', 'TRUE', ' true '])(
    'skips every check when DEV is "%s"',
    (value) => {
      const config = { DEV: value, DB_PASSWORD: 'root' };

      expect(validateEnvironment(config)).toBe(config);
    },
  );

  it.each(['false', '1', 'yes', ''])(
    'still validates when DEV is "%s"',
    (value) => {
      expect(
        problemsFor({ ...validConfig(), DEV: value, DB_PASSWORD: 'root' }),
      ).toEqual(['DB_PASSWORD: uses a well-known default value']);
    },
  );

  it('explains how to generate secrets in the error message', () => {
    expect(() => validateEnvironment({})).toThrow(/openssl rand -hex 32/);
  });
});
