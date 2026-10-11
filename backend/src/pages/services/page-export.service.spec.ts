import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { PageAccessForbiddenException } from '../../common/exceptions/pages/page-access-forbidden.exception.js';
import { MediaService } from '../../media/services/media.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { PageTreeNodeDto } from '../dto/out/page-tree-node.dto.js';
import { PageVersion } from '../entities/page-version.entity.js';
import { PageExportService } from './page-export.service.js';
import { PagesService } from './pages.service.js';

const INSTANCE_URL = 'https://wiki.example.com';
const MEDIA_ID = '11111111-2222-4333-8444-555555555555';
const PRIVATE_MEDIA_ID = '99999999-2222-4333-8444-555555555555';
const UPDATED_AT = new Date('2026-10-11T10:00:00Z');

function node(
  id: string,
  slug: string,
  children: PageTreeNodeDto[] = [],
): PageTreeNodeDto {
  return {
    id,
    slug,
    title: `Title ${slug}`,
    visibility: 'public',
    canCreateChild: false,
    children,
  };
}

const TREE: PageTreeNodeDto[] = [
  node('docs', 'docs', [
    node('guide', 'guide', [
      node('install', 'install', [node('linux', 'linux')]),
      node('api', 'api'),
    ]),
  ]),
  node('orphan', 'orphan'),
];

const PATHS = new Map([
  ['guide', '/docs/guide'],
  ['install', '/docs/guide/install'],
  ['linux', '/docs/guide/install/linux'],
  ['api', '/docs/guide/api'],
]);

const CONTENTS: Record<string, string> = {
  guide: `# Guide\n\n[Install](/pages/docs/guide/install) [FAQ](/pages/faq)\n\n![shot](/api/media/${MEDIA_ID}/raw)`,
  install: '[Linux](/pages/docs/guide/install/linux#setup)',
  linux: `![shot](${INSTANCE_URL}/api/media/${MEDIA_ID}/raw) ![secret](/api/media/${PRIVATE_MEDIA_ID}/raw)`,
  api: 'API',
};

describe('PageExportService', () => {
  let service: PageExportService;
  let pagesService: {
    getByIdOrFail: ReturnType<typeof vi.fn>;
    getTree: ReturnType<typeof vi.fn>;
  };
  let pagesRepository: { findCurrentVersions: ReturnType<typeof vi.fn> };
  let pageTrashRepository: { findPaths: ReturnType<typeof vi.fn> };
  let tagsService: {
    listTagsOfAlreadyAuthorizedPage: ReturnType<typeof vi.fn>;
  };
  let mediaService: { readForExport: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pagesService = {
      getByIdOrFail: vi.fn().mockResolvedValue({ id: 'guide', slug: 'guide' }),
      getTree: vi.fn().mockResolvedValue(TREE),
    };
    pagesRepository = {
      findCurrentVersions: vi.fn((ids: string[]) =>
        Promise.resolve(
          ids.map(
            (id) =>
              ({
                pageId: id,
                content: CONTENTS[id],
                createdAt: UPDATED_AT,
              }) as PageVersion,
          ),
        ),
      ),
    };
    pageTrashRepository = {
      findPaths: vi.fn((ids: string[]) =>
        Promise.resolve(
          new Map(ids.map((id) => [id, PATHS.get(id) ?? `/${id}`])),
        ),
      ),
    };
    tagsService = {
      listTagsOfAlreadyAuthorizedPage: vi.fn((id: string) =>
        Promise.resolve(id === 'guide' ? [{ name: 'howto' }] : []),
      ),
    };
    mediaService = {
      readForExport: vi.fn((id: string) =>
        Promise.resolve(
          id === MEDIA_ID
            ? { filename: 'shot.png', data: Buffer.from('png') }
            : null,
        ),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        PageExportService,
        { provide: PagesService, useValue: pagesService },
        { provide: 'PagesRepository', useValue: pagesRepository },
        { provide: 'PageTrashRepository', useValue: pageTrashRepository },
        { provide: TagsService, useValue: tagsService },
        { provide: MediaService, useValue: mediaService },
        {
          provide: ConfigService,
          useValue: { get: () => `${INSTANCE_URL}/` },
        },
      ],
    }).compile();

    service = module.get(PageExportService);
  });

  describe('collectSubtree', () => {
    it('returns the readable subtree in depth-first order, without pages hanging under an unreadable one', async () => {
      const pages = await service.collectSubtree('guide');

      expect(pagesService.getByIdOrFail).toHaveBeenCalledWith(
        'guide',
        undefined,
      );
      expect(pages.map((page) => [page.id, page.depth, page.path])).toEqual([
        ['guide', 0, '/docs/guide'],
        ['install', 1, '/docs/guide/install'],
        ['linux', 2, '/docs/guide/install/linux'],
        ['api', 1, '/docs/guide/api'],
      ]);
      expect(pages[0]).toMatchObject({
        title: 'Title guide',
        content: CONTENTS.guide,
        tags: ['howto'],
        updatedAt: UPDATED_AT,
      });
    });

    it('refuses a root the user cannot read', async () => {
      pagesService.getByIdOrFail.mockRejectedValue(
        new PageAccessForbiddenException(),
      );

      await expect(service.collectSubtree('guide')).rejects.toBeInstanceOf(
        PageAccessForbiddenException,
      );
    });
  });

  describe('exportPage', () => {
    it('returns the raw Markdown of the page with a YAML header and absolute wiki links', async () => {
      const file = await service.exportPage('guide');

      expect(pagesRepository.findCurrentVersions).toHaveBeenCalledWith([
        'guide',
      ]);
      expect(file.filename).toBe('guide.md');
      expect(file.content).toBe(
        [
          '---',
          'title: "Title guide"',
          'tags: ["howto"]',
          'updatedAt: 2026-10-11T10:00:00.000Z',
          `source: "${INSTANCE_URL}/pages/docs/guide"`,
          '---',
          '',
          `# Guide\n\n[Install](${INSTANCE_URL}/pages/docs/guide/install) [FAQ](${INSTANCE_URL}/pages/faq)\n\n![shot](${INSTANCE_URL}/api/media/${MEDIA_ID}/raw)`,
        ].join('\n'),
      );
      expect(mediaService.readForExport).not.toHaveBeenCalled();
    });
  });

  describe('exportSubtree', () => {
    it('lays out one .md per page with children in a folder, and each readable media once', async () => {
      const archive = await service.exportSubtree('guide');

      expect(archive.filename).toBe('guide.zip');
      expect(archive.entries.map((entry) => entry.name)).toEqual([
        'guide.md',
        'guide/install.md',
        'guide/install/linux.md',
        'guide/api.md',
        `_media/${MEDIA_ID}-shot.png`,
      ]);
      expect(mediaService.readForExport).toHaveBeenCalledTimes(2);
      expect(archive.entries[4].data).toEqual(Buffer.from('png'));
    });

    it('rewrites links between exported pages and to exported media relatively', async () => {
      const archive = await service.exportSubtree('guide');
      const content = (name: string) =>
        String(archive.entries.find((entry) => entry.name === name)?.data);

      expect(content('guide.md')).toContain(
        `[Install](guide/install.md) [FAQ](${INSTANCE_URL}/pages/faq)`,
      );
      expect(content('guide.md')).toContain(
        `![shot](_media/${MEDIA_ID}-shot.png)`,
      );
      expect(content('guide/install.md')).toContain(
        '[Linux](install/linux.md#setup)',
      );
      expect(content('guide/install/linux.md')).toContain(
        `![shot](../../_media/${MEDIA_ID}-shot.png) ![secret](${INSTANCE_URL}/api/media/${PRIVATE_MEDIA_ID}/raw)`,
      );
    });
  });

  describe('parseScope', () => {
    it('accepts page and subtree, defaults to page, and rejects anything else', () => {
      expect(PageExportService.parseScope(undefined)).toBe('page');
      expect(PageExportService.parseScope('page')).toBe('page');
      expect(PageExportService.parseScope('subtree')).toBe('subtree');
      expect(() => PageExportService.parseScope('all')).toThrow(
        ValidationException,
      );
    });
  });
});
