import { InvalidEnvironmentException } from '../common/exceptions/config/invalid-environment.exception.js';
import {
  KNOWN_DEFAULT_SECRETS,
  MIN_JWT_SECRET_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../common/variables.global.js';

type RawEnvironment = Record<string, unknown>;

function readValue(config: RawEnvironment, key: string): string | undefined {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value;
}

function isKnownDefault(value: string): boolean {
  return KNOWN_DEFAULT_SECRETS.includes(value.trim().toLowerCase());
}

function secretProblems(
  key: string,
  value: string,
  minLength: number,
): string[] {
  if (isKnownDefault(value)) {
    return [`${key}: uses a well-known default value`];
  }
  if (value.length < minLength) {
    return [`${key}: must be at least ${minLength} characters long`];
  }
  return [];
}

function requiredSecret(
  config: RawEnvironment,
  key: string,
  minLength = 1,
): string[] {
  const value = readValue(config, key);
  if (value === undefined) {
    return [`${key}: is required`];
  }
  return secretProblems(key, value, minLength);
}

function optionalSecret(
  config: RawEnvironment,
  key: string,
  minLength: number,
): string[] {
  const value = readValue(config, key);
  return value === undefined ? [] : secretProblems(key, value, minLength);
}

function distinctJwtSecrets(config: RawEnvironment): string[] {
  const access = readValue(config, 'JWT_ACCESS_SECRET');
  const refresh = readValue(config, 'JWT_REFRESH_SECRET');
  if (access !== undefined && access === refresh) {
    return ['JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET'];
  }
  return [];
}

export function validateEnvironment(config: RawEnvironment): RawEnvironment {
  const problems = [
    ...requiredSecret(config, 'JWT_ACCESS_SECRET', MIN_JWT_SECRET_LENGTH),
    ...requiredSecret(config, 'JWT_REFRESH_SECRET', MIN_JWT_SECRET_LENGTH),
    ...distinctJwtSecrets(config),
    ...requiredSecret(config, 'DB_PASSWORD'),
    ...requiredSecret(config, 'MINIO_SECRET_KEY'),
    ...optionalSecret(config, 'ADMIN_PASSWORD', MIN_PASSWORD_LENGTH),
  ];
  if (problems.length > 0) {
    throw new InvalidEnvironmentException(problems);
  }
  return config;
}
