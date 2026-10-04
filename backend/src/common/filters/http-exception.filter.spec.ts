import {
  ArgumentsHost,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

function fakeResponse(): {
  response: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  return { response, status, json };
}

describe('HttpExceptionFilter', () => {
  it('keeps the 429 of the throttler instead of turning it into a 500', () => {
    const { response, status, json } = fakeResponse();

    HttpExceptionFilter.respond(new ThrottlerException(), response);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      error: 'ThrottlerException: Too Many Requests',
    });
  });

  it('keeps the status of any other HTTP exception', () => {
    const { response, status } = fakeResponse();

    HttpExceptionFilter.respond(new PayloadTooLargeException(), response);

    expect(status).toHaveBeenCalledWith(413);
  });

  it('returns the raw Nest body for 401 and 403', () => {
    const { response, status, json } = fakeResponse();
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(new UnauthorizedException(), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      new UnauthorizedException().getResponse(),
    );
  });

  it('returns a 500 for an unknown error', () => {
    const { response, status, json } = fakeResponse();

    HttpExceptionFilter.respond(new Error('boom'), response);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'boom' });
  });

  it('exposes the status of an exception', () => {
    expect(HttpExceptionFilter.statusOf(new NotFoundException())).toBe(404);
    expect(HttpExceptionFilter.statusOf(new Error())).toBe(500);
  });
});
