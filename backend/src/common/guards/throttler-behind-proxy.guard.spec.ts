import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard.js';

class TestableThrottlerBehindProxyGuard extends ThrottlerBehindProxyGuard {
  skip(context: ExecutionContext): Promise<boolean> {
    return this.shouldSkip(context);
  }

  tracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
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

  describe('tracker', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('ignores the X-Forwarded-For entries the client wrote itself', async () => {
      expect(
        await buildGuard().tracker({
          headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' },
          ip: '127.0.0.1',
        }),
      ).toBe('203.0.113.9');
    });

    it('skips the trusted proxies configured with TRUST_PROXY_HOPS', async () => {
      vi.stubEnv('TRUST_PROXY_HOPS', '2');

      expect(
        await buildGuard().tracker({
          headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9, 172.18.0.5' },
          ip: '172.18.0.6',
        }),
      ).toBe('203.0.113.9');
    });

    it('falls back to the socket address without X-Forwarded-For', async () => {
      expect(
        await buildGuard().tracker({ headers: {}, ip: '198.51.100.7' }),
      ).toBe('198.51.100.7');
    });
  });
});
