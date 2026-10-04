import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { PagesExceptionFilter } from './pages-exception.filter.js';

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
  new PagesExceptionFilter().catch(exception, host);
  return response;
}

describe('PagesExceptionFilter', () => {
  it('maps its domain exceptions', () => {
    const response = catchWith(new PageNotFoundException());

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: new PageNotFoundException().message,
    });
  });

  it('lets a throttler 429 through instead of answering 500', () => {
    const response = catchWith(new ThrottlerException());

    expect(response.status).toHaveBeenCalledWith(429);
  });

  it('still forwards guard 403 responses untouched', () => {
    const response = catchWith(new ForbiddenException());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      new ForbiddenException().getResponse(),
    );
  });

  it('answers 500 for an unexpected error', () => {
    expect(catchWith(new Error('boom')).status).toHaveBeenCalledWith(500);
  });
});
