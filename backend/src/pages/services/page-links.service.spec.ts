import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Page } from '../entities/page.entity.js';
import type { PageLinkRepository } from '../persistence/page-link.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { PageLinksService } from './page-links.service.js';

const INSTANCE_URL = 'https://wiki.example.com';

function page(
  id: string,
  slug: string,
  parentId: string | null = null,
  title = slug,
): Page {
  return { id, slug, parentId, title } as Page;
}

const docs = page('docs', 'docs', null, 'Documentation');
const guide = page('guide', 'guide', 'docs', 'Guide');
const faq = page('faq', 'faq', null, 'FAQ');

describe('PageLinksService', () => {
  let service: PageLinksService;
  let pageLinksRepository: {
    [K in keyof PageLinkRepository]: Mock<PageLinkRepository[K]>;
  };
  let pagesRepository: { findAll: Mock<PagesRepository['findAll']> };

  beforeEach(async () => {
    pageLinksRepository = {
      replaceForPage: vi.fn().mockResolvedValue(undefined),
      findSourcePageIds: vi.fn().mockResolvedValue([]),
      findAllFromActiveSources: vi.fn().mockResolvedValue([]),
    };
    pagesRepository = {
      findAll: vi.fn().mockResolvedValue([docs, guide, faq]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PageLinksService,
        { provide: 'PageLinksRepository', useValue: pageLinksRepository },
        { provide: 'PagesRepository', useValue: pagesRepository },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(`${INSTANCE_URL}/`) },
        },
      ],
    }).compile();

    service = moduleRef.get(PageLinksService);
  });

  describe('syncPage', () => {
    it('stores the page paths linked from the content, tagged with the indexed version', async () => {
      await service.syncPage(
        'page-1',
        'version-2',
        `[Guide](/pages/docs/guide#setup) [FAQ](${INSTANCE_URL}/pages/faq)`,
      );

      expect(pageLinksRepository.replaceForPage).toHaveBeenCalledWith(
        'page-1',
        'version-2',
        ['/docs/guide', '/faq'],
      );
    });

    it('does not fail the caller when the index cannot be written', async () => {
      pageLinksRepository.replaceForPage.mockRejectedValue(new Error('down'));

      await expect(
        service.syncPage('page-1', 'version-2', '[a](/pages/docs)'),
      ).resolves.toBeUndefined();
    });
  });

  describe('findBrokenTargets', () => {
    it('lists the linked paths that match no active page', async () => {
      await expect(
        service.findBrokenTargets(
          '[ok](/pages/docs/guide) [ko](/pages/docs/missing) [case](/pages/FAQ)',
        ),
      ).resolves.toEqual(['/docs/missing']);
    });

    it('breaks a link when its target moves or goes to the trash, and repairs it once a page takes the path again', async () => {
      const content = '[Guide](/pages/docs/guide)';
      const movedGuide = page('guide', 'guide', null, 'Guide');
      const newGuide = page('guide-2', 'guide', 'docs', 'Guide v2');

      pagesRepository.findAll.mockResolvedValueOnce([docs, movedGuide, faq]);
      await expect(service.findBrokenTargets(content)).resolves.toEqual([
        '/docs/guide',
      ]);

      pagesRepository.findAll.mockResolvedValueOnce([docs, faq]);
      await expect(service.findBrokenTargets(content)).resolves.toEqual([
        '/docs/guide',
      ]);

      pagesRepository.findAll.mockResolvedValueOnce([docs, newGuide, faq]);
      await expect(service.findBrokenTargets(content)).resolves.toEqual([]);
    });

    it('does not load the pages when the content has no internal link', async () => {
      await expect(
        service.findBrokenTargets('[out](https://example.org)'),
      ).resolves.toEqual([]);
      expect(pagesRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findLinkingPageIds', () => {
    it('asks the index for the pages linking to the path, optionally to its descendants too', async () => {
      pageLinksRepository.findSourcePageIds.mockResolvedValue(['faq']);

      await expect(service.findLinkingPageIds('/docs', true)).resolves.toEqual([
        'faq',
      ]);
      expect(pageLinksRepository.findSourcePageIds).toHaveBeenCalledWith(
        '/docs',
        true,
      );
    });
  });

  describe('listBroken', () => {
    beforeEach(() => {
      pageLinksRepository.findAllFromActiveSources.mockResolvedValue([
        { sourcePageId: 'guide', targetPath: '/docs/old' },
        { sourcePageId: 'faq', targetPath: '/docs/guide' },
        { sourcePageId: 'faq', targetPath: '/nowhere' },
        { sourcePageId: 'docs', targetPath: '/zzz' },
        { sourcePageId: 'docs', targetPath: '/aaa' },
      ]);
    });

    it('returns the unresolved links sorted by source path then target, with their source page', async () => {
      const { items, total } = await service.listBroken({});

      expect(total).toBe(4);
      expect(items).toEqual([
        {
          sourcePage: { id: 'docs', title: 'Documentation', path: '/docs' },
          targetPath: '/aaa',
        },
        {
          sourcePage: { id: 'docs', title: 'Documentation', path: '/docs' },
          targetPath: '/zzz',
        },
        {
          sourcePage: { id: 'guide', title: 'Guide', path: '/docs/guide' },
          targetPath: '/docs/old',
        },
        {
          sourcePage: { id: 'faq', title: 'FAQ', path: '/faq' },
          targetPath: '/nowhere',
        },
      ]);
    });

    it('paginates', async () => {
      const { items, total } = await service.listBroken({
        page: '2',
        limit: '3',
      });

      expect(total).toBe(4);
      expect(items.map((item) => item.targetPath)).toEqual(['/nowhere']);
    });
  });
});
