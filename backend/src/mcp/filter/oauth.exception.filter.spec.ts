import { ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { OAuthExceptionFilter } from './oauth.exception.filter.js';

function catchWith(exception: Error): {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({
      getResponse: () => response as unknown as Response,
    }),
  } as unknown as ArgumentsHost;
  new OAuthExceptionFilter().catch(exception, host);
  return response;
}

describe('OAuthExceptionFilter', () => {
  it('answers 429 temporarily_unavailable when throttled', () => {
    const response = catchWith(new ThrottlerException());

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'temporarily_unavailable' }),
    );
  });

  it('answers 500 server_error for an unexpected error', () => {
    const response = catchWith(new Error('boom'));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'server_error',
      error_description: 'boom',
    });
  });
});
