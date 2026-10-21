import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { PageVersion } from '../entities/page-version.entity.js';
import { Page } from '../entities/page.entity.js';
import {
  PAGE_VERSION_CREATED_EVENT,
  PageVersionCreatedEvent,
} from '../events/page-version-created.event.js';
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
const reader = { id: 'reader', role: 'member' } as User;

describe('PageLinksService', () => {
  let service: PageLinksService;
  let pageLinksRepository: {
    [K in keyof PageLinkRepository]: Mock<PageLinkRepository[K]>;
  };
  let pagesRepository: {
    findAll: Mock<PagesRepository['findAll']>;
    findById: Mock<PagesRepository['findById']>;
    findVersionById: Mock<PagesRepository['findVersionById']>;
    updateWithNewVersion: Mock<PagesRepository['updateWithNewVersion']>;
  };
  let permissionsService: {
    filterReadable: Mock<PermissionsService['filterReadable']>;
    getEffectivePageActionsBulk: Mock<
      PermissionsService['getEffectivePageActionsBulk']
    >;
  };
  let eventEmitter: { emit: Mock };

  beforeEach(async () => {
    pageLinksRepository = {
      replaceForPage: vi.fn().mockResolvedValue(undefined),
      findSourcePageIds: vi.fn().mockResolvedValue([]),
      findAllFromActiveSources: vi.fn().mockResolvedValue([]),
    };
    pagesRepository = {
      findAll: vi.fn().mockResolvedValue([docs, guide, faq]),
      findById: vi.fn(),
      findVersionById: vi.fn(),
      updateWithNewVersion: vi.fn(),
    };
    permissionsService = {
      filterReadable: vi
        .fn()
        .mockImplementation((_user: User | undefined, pages: Page[]) =>
          Promise.resolve(pages),
        ),
      getEffectivePageActionsBulk: vi
        .fn()
        .mockImplementation((_user: User | undefined, pageIds: string[]) =>
          Promise.resolve(new Map(pageIds.map((id) => [id, ['page.edit']]))),
        ),
    };
    eventEmitter = { emit: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PageLinksService,
        { provide: 'PageLinksRepository', useValue: pageLinksRepository },
        { provide: 'PagesRepository', useValue: pagesRepository },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: EventEmitter2, useValue: eventEmitter },
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
          reader,
        ),
      ).resolves.toEqual(['/docs/missing']);
    });

    it('breaks a link when its target moves or goes to the trash, and repairs it once a page takes the path again', async () => {
      const content = '[Guide](/pages/docs/guide)';
      const movedGuide = page('guide', 'guide', null, 'Guide');
      const newGuide = page('guide-2', 'guide', 'docs', 'Guide v2');

      pagesRepository.findAll.mockResolvedValueOnce([docs, movedGuide, faq]);
      await expect(service.findBrokenTargets(content, reader)).resolves.toEqual(
        ['/docs/guide'],
      );

      pagesRepository.findAll.mockResolvedValueOnce([docs, faq]);
      await expect(service.findBrokenTargets(content, reader)).resolves.toEqual(
        ['/docs/guide'],
      );

      pagesRepository.findAll.mockResolvedValueOnce([docs, newGuide, faq]);
      await expect(service.findBrokenTargets(content, reader)).resolves.toEqual(
        [],
      );
    });

    it('treats a link to a page the reader cannot read as broken', async () => {
      permissionsService.filterReadable.mockImplementation((_user, pages) =>
        Promise.resolve(pages.filter((p) => p.id !== 'guide')),
      );

      await expect(
        service.findBrokenTargets(
          '[private](/pages/docs/guide) [public](/pages/faq)',
          undefined,
        ),
      ).resolves.toEqual(['/docs/guide']);
      expect(permissionsService.filterReadable).toHaveBeenCalledWith(
        undefined,
        [guide, faq],
      );
    });

    it('does not load the pages when the content has no internal link', async () => {
      await expect(
        service.findBrokenTargets('[out](https://example.org)', reader),
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

  describe('rewriteAfterMove', () => {
    const author = { id: 'mover', role: 'member' } as User;
    const move = { from: '/docs/guide', to: '/archive/guide' };
    const summary = 'Liens mis à jour après le déplacement de « Guide »';
    const contents: Record<string, string> = {
      faq: '[Guide](/pages/docs/guide) [Install](/pages/docs/guide/install#linux)',
      guide: '[Install](/pages/docs/guide/install) [FAQ](/pages/faq)',
      docs: '`[code](/pages/docs/guide)`',
    };

    beforeEach(() => {
      pageLinksRepository.findSourcePageIds.mockResolvedValue([
        'faq',
        'guide',
        'docs',
      ]);
      pagesRepository.findById.mockImplementation((id: string) => {
        const source = [docs, guide, faq].find((p) => p.id === id);
        return Promise.resolve(
          source ? { ...source, currentVersionId: `${id}-v1` } : null,
        );
      });
      pagesRepository.findVersionById.mockImplementation((id: string) => {
        const pageId = id.replace(/-v1$/, '');
        return Promise.resolve({
          id,
          pageId,
          content: contents[pageId],
        } as PageVersion);
      });
      pagesRepository.updateWithNewVersion.mockImplementation((input) =>
        Promise.resolve({
          page: { ...input.page, updatedAt: new Date('2026-10-21T10:00:00Z') },
          version: {
            id: `${input.page.id}-v2`,
            pageId: input.page.id,
            content: input.content,
          } as PageVersion,
        }),
      );
    });

    it('gives every linking page a single new version with the moved paths, including pages of the moved subtree', async () => {
      const result = await service.rewriteAfterMove(move, 'Guide', author);

      expect(pageLinksRepository.findSourcePageIds).toHaveBeenCalledWith(
        '/docs/guide',
        true,
      );
      const [faqInput, guideInput, ...others] =
        pagesRepository.updateWithNewVersion.mock.calls.map(([input]) => input);
      expect(others).toEqual([]);
      expect(faqInput.page.id).toBe('faq');
      expect(faqInput).toMatchObject({
        title: 'FAQ',
        content:
          '[Guide](/pages/archive/guide) [Install](/pages/archive/guide/install#linux)',
        changeSummary: summary,
        authorId: 'mover',
      });
      expect(guideInput.page.id).toBe('guide');
      expect(guideInput.content).toBe(
        '[Install](/pages/archive/guide/install) [FAQ](/pages/faq)',
      );
      expect(result).toEqual({
        linksUpdated: 3,
        pagesUpdated: 2,
        pagesSkipped: 0,
      });
    });

    it('reindexes each rewritten page and announces its new version', async () => {
      await service.rewriteAfterMove(move, 'Guide', author);

      expect(pageLinksRepository.replaceForPage).toHaveBeenCalledWith(
        'faq',
        'faq-v2',
        ['/archive/guide', '/archive/guide/install'],
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAGE_VERSION_CREATED_EVENT,
        new PageVersionCreatedEvent(
          'faq',
          'faq-v2',
          'mover',
          'FAQ',
          '[Guide](/pages/archive/guide) [Install](/pages/archive/guide/install#linux)',
          summary,
          new Date('2026-10-21T10:00:00Z'),
        ),
      );
    });

    it('leaves the pages the author cannot edit untouched and counts them', async () => {
      permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
        new Map([
          ['faq', ['page.read']],
          ['guide', ['page.read', 'page.edit']],
          ['docs', []],
        ]),
      );

      const result = await service.rewriteAfterMove(move, 'Guide', author);

      expect(
        permissionsService.getEffectivePageActionsBulk,
      ).toHaveBeenCalledWith(author, ['faq', 'guide', 'docs']);
      expect(
        pagesRepository.updateWithNewVersion.mock.calls.map(
          ([input]) => input.page.id,
        ),
      ).toEqual(['guide']);
      expect(result).toEqual({
        linksUpdated: 1,
        pagesUpdated: 1,
        pagesSkipped: 1,
      });
    });

    it('keeps the change summary within its maximum length', async () => {
      await service.rewriteAfterMove(move, 'x'.repeat(255), author);

      const [[input]] = pagesRepository.updateWithNewVersion.mock.calls;
      expect(input.changeSummary).toHaveLength(255);
    });

    it('does nothing when the page keeps its path', async () => {
      await expect(
        service.rewriteAfterMove(
          { from: '/docs/guide', to: '/docs/guide' },
          'Guide',
          author,
        ),
      ).resolves.toEqual({ linksUpdated: 0, pagesUpdated: 0, pagesSkipped: 0 });
      expect(pageLinksRepository.findSourcePageIds).not.toHaveBeenCalled();
    });
  });
});
