import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PageHierarchyRepository } from '../../permissions/persistence/page-hierarchy.repository.js';
import { Page } from '../entities/page.entity.js';
import type { PageTrashRepository } from '../persistence/page-trash.repository.js';
import { PageReferenceService } from './page-reference.service.js';

function page(overrides: Partial<Page>): Page {
  return {
    id: 'page',
    slug: 'page',
    title: 'Page',
    parentId: null,
    visibility: 'public',
    deletedAt: null,
    ...overrides,
  } as Page;
}

describe('PageReferenceService', () => {
  let service: PageReferenceService;
  let pageTrashRepository: {
    findByIdWithDeleted: Mock<PageTrashRepository['findByIdWithDeleted']>;
    findPaths: Mock<PageTrashRepository['findPaths']>;
  };
  let pageHierarchyRepository: {
    findChains: Mock<PageHierarchyRepository['findChains']>;
  };
  const install = page({
    id: 'install',
    slug: 'install',
    title: 'Installation',
    parentId: 'guide',
    visibility: 'private',
    deletedAt: new Date(),
  });

  beforeEach(async () => {
    pageTrashRepository = {
      findByIdWithDeleted: vi.fn((id: string) =>
        Promise.resolve(id === 'install' ? install : null),
      ),
      findPaths: vi
        .fn()
        .mockResolvedValue(new Map([['install', '/docs/guide/install']])),
    };
    pageHierarchyRepository = {
      findChains: vi.fn().mockResolvedValue(
        new Map([
          [
            'install',
            {
              pageId: 'install',
              visibility: 'private',
              chainIds: ['install', 'guide', 'docs'],
            },
          ],
        ]),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PageReferenceService,
        { provide: 'PageTrashRepository', useValue: pageTrashRepository },
        {
          provide: 'PageHierarchyRepository',
          useValue: pageHierarchyRepository,
        },
      ],
    }).compile();
    service = moduleRef.get(PageReferenceService);
  });

  it('describes a page with its path and its ancestors, even from the trash', async () => {
    await expect(service.describe('install')).resolves.toEqual({
      id: 'install',
      title: 'Installation',
      path: '/docs/guide/install',
      visibility: 'private',
      ancestorIds: ['docs', 'guide'],
      inTrash: true,
    });
    expect(pageHierarchyRepository.findChains).toHaveBeenCalledWith(
      ['install'],
      { includeDeleted: true },
    );
  });

  it('returns null for an unknown page', async () => {
    await expect(service.describe('missing')).resolves.toBeNull();
    expect(pageHierarchyRepository.findChains).not.toHaveBeenCalled();
  });
});
