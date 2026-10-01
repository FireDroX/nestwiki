import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows the request when no roles are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('allows the request when the user role is in the required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      'admin',
      'member',
    ]);

    expect(guard.canActivate(buildContext({ id: 'u1', role: 'member' }))).toBe(
      true,
    );
  });

  it('throws ForbiddenException when the user role is not allowed', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(() =>
      guard.canActivate(buildContext({ id: 'u1', role: 'member' })),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user on the request', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
