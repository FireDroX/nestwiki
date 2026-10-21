import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
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
  };
  const docs = page({ id: 'docs', slug: 'docs', title: 'Docs' });
  const guide = page({
    id: 'guide',
    slug: 'guide',
    title: 'Guide',
    parentId: 'docs',
    deletedAt: new Date(),
  });
  const install = page({
    id: 'install',
    slug: 'install',
    title: 'Installation',
    parentId: 'guide',
    visibility: 'private',
    deletedAt: new Date(),
  });

  beforeEach(async () => {
    const pages = [docs, guide, install];
    pageTrashRepository = {
      findByIdWithDeleted: vi.fn((id: string) =>
        Promise.resolve(pages.find((p) => p.id === id) ?? null),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PageReferenceService,
        { provide: 'PageTrashRepository', useValue: pageTrashRepository },
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
  });

  it('returns null for an unknown page', async () => {
    await expect(service.describe('missing')).resolves.toBeNull();
  });
});
