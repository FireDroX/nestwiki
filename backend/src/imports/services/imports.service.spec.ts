import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import type { Page } from '../../pages/entities/page.entity.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { ImportMapper } from '../mapper/import.mapper.js';
import { ImportsService } from './imports.service.js';

const currentUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'u@x.com',
  role: 'member',
};
const user = { id: 'user-1', role: 'member' } as User;
const DOCS_ID = '11111111-1111-4111-8111-111111111111';
const GUIDE_ID = '22222222-2222-4222-8222-222222222222';

function page(id: string, slug: string, parentId: string | null): Page {
  return { id, slug, parentId, title: slug } as Page;
}

function markdownFile(name: string, content: string) {
  const buffer = Buffer.from(content);
  return { originalname: name, size: buffer.length, buffer };
}

describe('ImportsService', () => {
  let service: ImportsService;
  let can: Mock;
  let hasGlobal: Mock;
  let getByIdOrFail: Mock;

  beforeEach(async () => {
    can = vi.fn().mockResolvedValue(true);
    hasGlobal = vi.fn().mockResolvedValue(true);
    getByIdOrFail = vi.fn().mockResolvedValue(page(DOCS_ID, 'docs', null));

    const module = await Test.createTestingModule({
      providers: [
        ImportsService,
        {
          provide: PagesService,
          useValue: {
            getByIdOrFail,
            listAllPages: vi
              .fn()
              .mockResolvedValue([
                page(DOCS_ID, 'docs', null),
                page(GUIDE_ID, 'guide', DOCS_ID),
              ]),
          },
        },
        { provide: PermissionsService, useValue: { can, hasGlobal } },
        {
          provide: UsersService,
          useValue: { findById: vi.fn().mockResolvedValue(user) },
        },
        {
          provide: TagsService,
          useValue: {
            listTags: vi.fn().mockResolvedValue([{ name: 'Projet' }]),
          },
        },
      ],
    }).compile();

    service = module.get(ImportsService);
  });

  it('requires page.create_child on the destination page', async () => {
    can.mockResolvedValue(false);

    await expect(
      service.preview(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID },
        currentUser,
      ),
    ).rejects.toThrow(InsufficientPagePermissionException);
    expect(can).toHaveBeenCalledWith(user, 'page.create_child', DOCS_ID);
  });

  it('requires page.create_root to import at the root', async () => {
    hasGlobal.mockResolvedValue(false);

    await expect(
      service.preview(markdownFile('guide.md', '# Guide'), {}, currentUser),
    ).rejects.toThrow(InsufficientPagePermissionException);
    expect(hasGlobal).toHaveBeenCalledWith(user, 'page.create_root');
  });

  it('fails when the destination page cannot be read', async () => {
    getByIdOrFail.mockRejectedValue(new PageNotFoundException());

    await expect(
      service.preview(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID },
        currentUser,
      ),
    ).rejects.toThrow(PageNotFoundException);
  });

  it('checks the rights before reading the file', async () => {
    can.mockResolvedValue(false);

    await expect(
      service.preview(undefined, { parentId: DOCS_ID }, currentUser),
    ).rejects.toThrow(InsufficientPagePermissionException);
  });

  it('rejects an invalid parentId or conflict mode', async () => {
    await expect(
      service.preview(
        markdownFile('a.md', '# A'),
        { parentId: 'nope' },
        currentUser,
      ),
    ).rejects.toThrow(ValidationException);
    await expect(
      service.preview(
        markdownFile('a.md', '# A'),
        { conflict: 'merge' },
        currentUser,
      ),
    ).rejects.toThrow(ValidationException);
  });

  it('computes the plan under the destination with conflicts, tags and permissions', async () => {
    hasGlobal.mockImplementation((_user: User, permission: string) =>
      Promise.resolve(permission !== 'tag.create'),
    );

    const plan = ImportMapper.toPlanDto(
      await service.preview(
        markdownFile(
          'guide.md',
          '---\ntags: [projet, nouveau]\n---\n# Guide\n\n[[Absente]]',
        ),
        { parentId: DOCS_ID },
        currentUser,
      ),
    );

    expect(plan).toMatchObject({
      format: 'obsidian',
      destination: { id: DOCS_ID, path: '/docs' },
      conflictMode: 'skip',
      pageCount: 1,
      conflictCount: 1,
      pages: [
        {
          path: '/docs/guide',
          title: 'Guide',
          action: 'skip',
          conflict: { path: '/docs/guide' },
          children: [],
        },
      ],
      tags: { existing: ['projet'], missing: ['nouveau'] },
      permissions: { canCreateTags: false, canUploadMedia: true },
      warnings: {
        unresolvedLinks: [{ page: '/docs/guide', target: 'Absente' }],
        missingTags: ['nouveau'],
        mediaWithoutUpload: 0,
      },
    });
  });

  it('applies the requested conflict mode to the paths', async () => {
    const plan = ImportMapper.toPlanDto(
      await service.preview(
        markdownFile('guide.md', '# Guide'),
        { parentId: DOCS_ID, conflict: 'rename' },
        currentUser,
      ),
    );

    expect(plan.pages[0]).toMatchObject({
      path: '/docs/guide-2',
      action: 'create',
      conflict: null,
    });
    expect(plan.warnings.renamedSlugs).toEqual([
      {
        page: '/docs/guide-2',
        from: 'guide',
        to: 'guide-2',
        reason: 'conflict',
      },
    ]);
  });
});
