import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageStatsResponseDto } from '../../pages/dto/out/page-stats-response.dto.js';
import { PageVersion } from '../../pages/entities/page-version.entity.js';
import { Page } from '../../pages/entities/page.entity.js';
import { PageStatsService } from '../../pages/services/page-stats.service.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import {
  DEFAULT_META_DESCRIPTION,
  DEFAULT_META_TITLE,
} from '../constants/meta.constants.js';
import { MetaService } from './meta.service.js';

const ORIGIN = 'https://wiki.example.com';

function buildPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    slug: 'home',
    title: 'Home',
    parentId: null,
    currentVersionId: 'version-1',
    visibility: 'public',
    commentsEnabled: true,
    viewCount: 0,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

const version = { id: 'version-1', authorId: 'author-1' } as PageVersion;

const stats: PageStatsResponseDto = {
  viewCount: 1240,
  lastModifiedAt: new Date('2026-10-01T10:00:00Z'),
  lastModifiedBy: { id: 'author-1', displayName: 'Alice' },
  versionsCount: 12,
  commentsCount: 5,
  contributorsCount: 3,
};

describe('MetaService', () => {
  let service: MetaService;
  let pagesService: { findPublicByPath: ReturnType<typeof vi.fn> };
  let pageStatsService: { getStatsForPage: ReturnType<typeof vi.fn> };
  let tagsService: {
    listTagsOfAlreadyAuthorizedPage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    pagesService = { findPublicByPath: vi.fn() };
    pageStatsService = { getStatsForPage: vi.fn().mockResolvedValue(stats) };
    tagsService = {
      listTagsOfAlreadyAuthorizedPage: vi
        .fn()
        .mockResolvedValue([{ name: 'guide' }, { name: 'installation' }]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MetaService,
        { provide: PagesService, useValue: pagesService },
        { provide: PageStatsService, useValue: pageStatsService },
        { provide: TagsService, useValue: tagsService },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(`${ORIGIN}/`) },
        },
      ],
    }).compile();

    service = moduleRef.get(MetaService);
  });

  it('builds the card of a nested public page from its breadcrumb, tags and stats', async () => {
    const docs = buildPage({ id: 'docs', title: 'Documentation' });
    const install = buildPage({ id: 'install', title: 'Installation' });
    pagesService.findPublicByPath.mockResolvedValue({
      page: install,
      version,
      ancestors: [docs],
    });

    const meta = await service.getPageMeta(['docs', 'install']);

    expect(pageStatsService.getStatsForPage).toHaveBeenCalledWith(
      install,
      version,
    );
    expect(tagsService.listTagsOfAlreadyAuthorizedPage).toHaveBeenCalledWith(
      'install',
    );
    expect(meta.title).toBe('Installation — OpenWiki');
    expect(meta.description).toBe(
      'Documentation › Installation · 2 tags · 1 240 vues',
    );
    expect(meta.url).toBe(`${ORIGIN}/pages/docs/install`);
    expect(meta.imageUrl).toBe(`${ORIGIN}/og-image.png`);

    const actionRow = meta.discordEmbed?.component.components.at(-1);
    expect(actionRow).toEqual({
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: 'Ouvrir la page',
          url: `${ORIGIN}/pages/docs/install`,
        },
        {
          type: 2,
          style: 5,
          label: 'Modifier',
          url: `${ORIGIN}/edit/docs/install`,
        },
      ],
    });
  });

  it('falls back to the default card without loading anything else when the page is not publicly readable', async () => {
    pagesService.findPublicByPath.mockResolvedValue(null);

    const meta = await service.getPageMeta(['secret']);

    expect(meta).toEqual({
      title: DEFAULT_META_TITLE,
      description: DEFAULT_META_DESCRIPTION,
      url: ORIGIN,
      imageUrl: `${ORIGIN}/og-image.png`,
      discordEmbed: null,
    });
    expect(pageStatsService.getStatsForPage).not.toHaveBeenCalled();
    expect(tagsService.listTagsOfAlreadyAuthorizedPage).not.toHaveBeenCalled();
  });

  it('url-encodes path segments in the page and edit urls', async () => {
    pagesService.findPublicByPath.mockResolvedValue({
      page: buildPage(),
      version,
      ancestors: [],
    });

    const meta = await service.getPageMeta(['a b']);

    expect(meta.url).toBe(`${ORIGIN}/pages/a%20b`);
    const actionRow = meta.discordEmbed?.component.components.at(-1);
    expect(actionRow?.type === 1 && actionRow.components[1].url).toBe(
      `${ORIGIN}/edit/a%20b`,
    );
  });
});
