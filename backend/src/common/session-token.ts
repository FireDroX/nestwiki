import type { User, UserRole } from '../users/entities/user.entity.js';
import { PASSWORD_CHANGE_CLOCK_TOLERANCE_MS } from './variables.global.js';

export interface SessionTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type?: string;
  iat?: number;
  exp?: number;
}

export function wasIssuedBeforePasswordChange(
  user: Pick<User, 'passwordChangedAt'>,
  issuedAtSeconds: number | undefined,
): boolean {
  if (!user.passwordChangedAt || issuedAtSeconds === undefined) {
    return false;
  }
  return (
    user.passwordChangedAt.getTime() - PASSWORD_CHANGE_CLOCK_TOLERANCE_MS >
    issuedAtSeconds * 1000
  );
}
