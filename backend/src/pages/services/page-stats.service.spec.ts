import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsService } from '../../comments/services/comments.service.js';
import { PageAccessForbiddenException } from '../../common/exceptions/pages/page-access-forbidden.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { UsersService } from '../../users/services/users.service.js';
import { VersionsService } from '../../versions/services/versions.service.js';
import { PageVersion } from '../entities/page-version.entity.js';
import { Page } from '../entities/page.entity.js';
import { PageStatsService } from './page-stats.service.js';
import { PagesService } from './pages.service.js';

const member: AuthenticatedUser = {
  id: 'm1',
  email: 'm@x.com',
  role: 'member',
};

const page = {
  id: 'page-1',
  slug: 'guide',
  title: 'Guide',
  viewCount: 1240,
} as Page;

const lastModifiedAt = new Date('2026-10-01T10:00:00Z');

const version = {
  id: 'version-3',
  pageId: 'page-1',
  authorId: 'author-1',
  createdAt: lastModifiedAt,
} as PageVersion;

describe('PageStatsService', () => {
  let service: PageStatsService;
  let pagesService: { getReadableWithCurrentVersion: ReturnType<typeof vi.fn> };
  let versionsService: {
    countByPage: ReturnType<typeof vi.fn>;
    countContributors: ReturnType<typeof vi.fn>;
  };
  let commentsService: { countByPage: ReturnType<typeof vi.fn> };
  let usersService: { findById: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pagesService = {
      getReadableWithCurrentVersion: vi
        .fn()
        .mockResolvedValue({ page, version }),
    };
    versionsService = {
      countByPage: vi.fn().mockResolvedValue(12),
      countContributors: vi.fn().mockResolvedValue(3),
    };
    commentsService = { countByPage: vi.fn().mockResolvedValue(5) };
    usersService = {
      findById: vi
        .fn()
        .mockResolvedValue({ id: 'author-1', displayName: 'Alice' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PageStatsService,
        { provide: PagesService, useValue: pagesService },
        { provide: VersionsService, useValue: versionsService },
        { provide: CommentsService, useValue: commentsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(PageStatsService);
  });

  it('aggregates the stats of a readable page', async () => {
    const stats = await service.getStatsById('page-1', member);

    expect(pagesService.getReadableWithCurrentVersion).toHaveBeenCalledWith(
      'page-1',
      member,
    );
    expect(versionsService.countByPage).toHaveBeenCalledWith('page-1');
    expect(commentsService.countByPage).toHaveBeenCalledWith('page-1');
    expect(versionsService.countContributors).toHaveBeenCalledWith('page-1');
    expect(stats).toEqual({
      viewCount: 1240,
      lastModifiedAt,
      lastModifiedBy: { id: 'author-1', displayName: 'Alice' },
      versionsCount: 12,
      commentsCount: 5,
      contributorsCount: 3,
    });
  });

  it('works for an anonymous visitor on a public page', async () => {
    const stats = await service.getStatsById('page-1');

    expect(pagesService.getReadableWithCurrentVersion).toHaveBeenCalledWith(
      'page-1',
      undefined,
    );
    expect(stats.viewCount).toBe(1240);
  });

  it('returns a null last author when the author no longer exists', async () => {
    usersService.findById.mockRejectedValue(new Error('not found'));

    const stats = await service.getStatsById('page-1', member);

    expect(stats.lastModifiedBy).toBeNull();
  });

  it('propagates PageAccessForbiddenException for an unreadable private page', async () => {
    pagesService.getReadableWithCurrentVersion.mockRejectedValue(
      new PageAccessForbiddenException(),
    );

    await expect(service.getStatsById('page-1', member)).rejects.toBeInstanceOf(
      PageAccessForbiddenException,
    );
    expect(versionsService.countByPage).not.toHaveBeenCalled();
  });

  it('propagates PageNotFoundException for an unknown path', async () => {
    pagesService.getReadableWithCurrentVersion.mockRejectedValue(
      new PageNotFoundException(),
    );

    await expect(service.getStatsById('nope')).rejects.toBeInstanceOf(
      PageNotFoundException,
    );
  });
});
