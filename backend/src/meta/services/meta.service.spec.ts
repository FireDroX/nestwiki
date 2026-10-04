import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Page } from '../../pages/entities/page.entity.js';
import { PagesService } from '../../pages/services/pages.service.js';
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

describe('MetaService', () => {
  let service: MetaService;
  let pagesService: { findPublicByPath: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pagesService = { findPublicByPath: vi.fn() };
    configService = { get: vi.fn().mockReturnValue(`${ORIGIN}/`) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MetaService,
        { provide: PagesService, useValue: pagesService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(MetaService);
  });

  it('returns the page title, breadcrumb and absolute urls for a nested public page', async () => {
    const docs = buildPage({
      id: 'docs',
      slug: 'docs',
      title: 'Documentation',
    });
    const guide = buildPage({ id: 'guide', slug: 'guide', title: 'Guides' });
    const install = buildPage({
      id: 'install',
      slug: 'install',
      title: 'Installation',
    });
    pagesService.findPublicByPath.mockResolvedValue({
      page: install,
      ancestors: [docs, guide],
    });

    const meta = await service.getPageMeta(['docs', 'guide', 'install']);

    expect(pagesService.findPublicByPath).toHaveBeenCalledWith([
      'docs',
      'guide',
      'install',
    ]);
    expect(meta).toEqual({
      title: 'Installation — OpenWiki',
      description: 'Documentation › Guides › Installation',
      url: `${ORIGIN}/pages/docs/guide/install`,
      imageUrl: `${ORIGIN}/og-image.png`,
      discordEmbed: {
        component: {
          type: 17,
          accent_color: 0xec3013,
          components: [{ type: 10, content: '# Installation' }],
        },
      },
    });
  });

  it('uses a generic description for a root page', async () => {
    const root = buildPage({ title: 'Documentation' });
    pagesService.findPublicByPath.mockResolvedValue({
      page: root,
      ancestors: [],
    });

    const meta = await service.getPageMeta(['documentation']);

    expect(meta.title).toBe('Documentation — OpenWiki');
    expect(meta.description).toBe('Page du wiki OpenWiki.');
    expect(meta.url).toBe(`${ORIGIN}/pages/documentation`);
  });

  it('falls back to the default card without leaking anything when the page is not publicly readable', async () => {
    pagesService.findPublicByPath.mockResolvedValue(null);

    const meta = await service.getPageMeta(['secret']);

    expect(meta).toEqual({
      title: DEFAULT_META_TITLE,
      description: DEFAULT_META_DESCRIPTION,
      url: ORIGIN,
      imageUrl: `${ORIGIN}/og-image.png`,
      discordEmbed: null,
    });
  });

  it('url-encodes path segments in the page url', async () => {
    pagesService.findPublicByPath.mockResolvedValue({
      page: buildPage(),
      ancestors: [],
    });

    const meta = await service.getPageMeta(['a b']);

    expect(meta.url).toBe(`${ORIGIN}/pages/a%20b`);
  });
});
