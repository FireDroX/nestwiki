import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard.js';

class TestableThrottlerBehindProxyGuard extends ThrottlerBehindProxyGuard {
  skip(context: ExecutionContext): Promise<boolean> {
    return this.shouldSkip(context);
  }
}

function buildGuard(): TestableThrottlerBehindProxyGuard {
  return new TestableThrottlerBehindProxyGuard(
    [] as ThrottlerModuleOptions,
    {} as ThrottlerStorage,
    new Reflector(),
  );
}

function contextOfType(type: string): ExecutionContext {
  return {
    getType: vi.fn().mockReturnValue(type),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as ExecutionContext;
}

describe('ThrottlerBehindProxyGuard', () => {
  it('skips WebSocket messages, which carry no HTTP request to track', async () => {
    expect(await buildGuard().skip(contextOfType('ws'))).toBe(true);
  });

  it('keeps throttling HTTP requests', async () => {
    expect(await buildGuard().skip(contextOfType('http'))).toBe(false);
  });
});
