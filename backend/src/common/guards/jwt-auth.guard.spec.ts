import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();

  it('returns the user when authentication succeeds', () => {
    const user = { id: 'u1', email: 'user@example.com', role: 'member' };

    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('throws UnauthorizedException when there is no user', () => {
    expect(() => guard.handleRequest(null, false)).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when passport reports an error', () => {
    expect(() =>
      guard.handleRequest(new Error('invalid token'), false),
    ).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException on an absent/invalid token even if a user is somehow present', () => {
    const user = { id: 'u1', email: 'user@example.com', role: 'member' };

    expect(() => guard.handleRequest(new Error('jwt expired'), user)).toThrow(
      UnauthorizedException,
    );
  });
});
