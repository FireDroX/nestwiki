import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { MergeTooLargeException } from '../../common/exceptions/pages/merge-too-large.exception.js';
import { PageContentTooLargeException } from '../../common/exceptions/pages/page-content-too-large.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { VersionDiffTooLargeException } from '../../common/exceptions/pages/version-diff-too-large.exception.js';
import { PageNotInTrashException } from '../../common/exceptions/pages/page-not-in-trash.exception.js';
import { ParentInTrashException } from '../../common/exceptions/pages/parent-in-trash.exception.js';
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

  it('maps the trash exceptions', () => {
    expect(
      catchWith(new PageNotInTrashException()).status,
    ).toHaveBeenCalledWith(404);
    expect(catchWith(new ParentInTrashException()).status).toHaveBeenCalledWith(
      409,
    );
  });

  it('maps the size limits of contents, merges and diffs', () => {
    expect(
      catchWith(new PageContentTooLargeException()).status,
    ).toHaveBeenCalledWith(413);
    expect(catchWith(new MergeTooLargeException()).status).toHaveBeenCalledWith(
      413,
    );
    expect(
      catchWith(new VersionDiffTooLargeException()).status,
    ).toHaveBeenCalledWith(422);
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
