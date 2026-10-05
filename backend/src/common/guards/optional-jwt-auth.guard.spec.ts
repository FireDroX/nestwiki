import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';
import { AnonymousFallbackJwtAuthGuard } from './anonymous-fallback-jwt-auth.guard.js';

function contextWithCookies(
  cookies: Record<string, string> | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ cookies }) }),
  } as unknown as ExecutionContext;
}

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();
  const user = { id: 'u1', email: 'user@example.com', role: 'admin' };

  it('returns the user when authentication succeeds', () => {
    expect(
      guard.handleRequest(null, user, undefined, contextWithCookies({})),
    ).toBe(user);
  });

  it('treats a request without any session cookie as anonymous', () => {
    expect(
      guard.handleRequest(null, false, undefined, contextWithCookies({})),
    ).toBeUndefined();
    expect(
      guard.handleRequest(
        null,
        false,
        undefined,
        contextWithCookies(undefined),
      ),
    ).toBeUndefined();
  });

  it('rejects with 401 when the access token expired but a refresh token is still present', () => {
    expect(() =>
      guard.handleRequest(
        null,
        false,
        undefined,
        contextWithCookies({ refreshToken: 'refresh' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects with 401 when the access token cookie is present but invalid', () => {
    expect(() =>
      guard.handleRequest(
        new Error('jwt expired'),
        false,
        undefined,
        contextWithCookies({ accessToken: 'expired' }),
      ),
    ).toThrow(UnauthorizedException);
  });
});

describe('AnonymousFallbackJwtAuthGuard', () => {
  const guard = new AnonymousFallbackJwtAuthGuard();

  it('falls back to anonymous even when a stale session cookie is present', () => {
    expect(guard.handleRequest(null, false)).toBeUndefined();
  });
});
