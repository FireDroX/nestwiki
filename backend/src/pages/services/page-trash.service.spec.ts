import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PageNotInTrashException } from '../../common/exceptions/pages/page-not-in-trash.exception.js';
import { ParentInTrashException } from '../../common/exceptions/pages/parent-in-trash.exception.js';
import { SlugAlreadyExistsException } from '../../common/exceptions/pages/slug-already-exists.exception.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { Page } from '../entities/page.entity.js';
import { PAGE_TREE_CHANGED_EVENT } from '../events/page-tree-changed.event.js';
import type { PageTrashRepository } from '../persistence/page-trash.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { PageTrashService } from './page-trash.service.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    passwordHash: 'hash',
    role: 'member',
    avatarExtension: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    slug: 'home',
    title: 'Home',
    parentId: null,
    currentVersionId: 'version-1',
    visibility: 'private',
    commentsEnabled: true,
    viewCount: 0,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deletionRootId: null,
    ...overrides,
  };
}

function trashedRoot(overrides: Partial<Page> = {}): Page {
  return buildPage({
    id: 'root',
    slug: 'guide',
    title: 'Guide',
    deletedAt: new Date('2026-10-10T10:00:00Z'),
    deletedById: 'u1',
    deletionRootId: 'root',
    ...overrides,
  });
}

describe('PageTrashService', () => {
  let service: PageTrashService;
  let pageTrashRepository: {
    [K in keyof PageTrashRepository]: Mock<PageTrashRepository[K]>;
  };
  let pagesRepository: {
    findBySlugAndParent: Mock<PagesRepository['findBySlugAndParent']>;
  };
  let permissionsService: {
    getEffectivePageActionsBulk: Mock<
      PermissionsService['getEffectivePageActionsBulk']
    >;
  };
  let usersService: { findById: Mock<UsersService['findById']> };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let userActivityLogService: { record: ReturnType<typeof vi.fn> };

  function allowDelete(): void {
    permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
      new Map([['root', ['page.delete']]]),
    );
  }

  beforeEach(async () => {
    pageTrashRepository = {
      findDeletionRoots: vi.fn().mockResolvedValue([]),
      countBatches: vi.fn().mockResolvedValue(new Map()),
      findTrashedById: vi.fn().mockResolvedValue(null),
      findByIdWithDeleted: vi.fn().mockResolvedValue(null),
      findPaths: vi.fn().mockResolvedValue(new Map()),
      restoreBatch: vi.fn().mockResolvedValue(undefined),
      findTrashedSubtreeIds: vi.fn().mockResolvedValue([]),
      purge: vi.fn().mockResolvedValue(undefined),
    };
    pagesRepository = { findBySlugAndParent: vi.fn().mockResolvedValue(null) };
    permissionsService = {
      getEffectivePageActionsBulk: vi.fn().mockResolvedValue(new Map()),
    };
    usersService = {
      findById: vi
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(buildUser({ id, displayName: `Name of ${id}` })),
        ),
    };
    eventEmitter = { emit: vi.fn() };
    userActivityLogService = { record: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        PageTrashService,
        { provide: 'PageTrashRepository', useValue: pageTrashRepository },
        { provide: 'PagesRepository', useValue: pagesRepository },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: UsersService, useValue: usersService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: UserActivityLogService, useValue: userActivityLogService },
      ],
    }).compile();

    service = module.get(PageTrashService);
  });

  describe('listTrash', () => {
    it('returns only deletion roots the user may delete, with path, deleter and descendant count', async () => {
      const root = trashedRoot({ parentId: 'parent' });
      const hidden = trashedRoot({ id: 'hidden', deletionRootId: 'hidden' });
      pageTrashRepository.findDeletionRoots.mockResolvedValue([root, hidden]);
      permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
        new Map([
          ['root', ['page.delete']],
          ['hidden', ['page.read']],
        ]),
      );
      pageTrashRepository.countBatches.mockResolvedValue(
        new Map([['root', 3]]),
      );
      pageTrashRepository.findPaths.mockResolvedValue(
        new Map([['root', '/docs/guide']]),
      );

      const entries = await service.listTrash('me');

      expect(
        permissionsService.getEffectivePageActionsBulk,
      ).toHaveBeenCalledWith(expect.anything(), ['root', 'hidden'], {
        includeDeleted: true,
      });
      expect(pageTrashRepository.countBatches).toHaveBeenCalledWith(['root']);
      expect(pageTrashRepository.findPaths).toHaveBeenCalledWith(['root']);
      expect(pageTrashRepository.findByIdWithDeleted).not.toHaveBeenCalled();
      expect(entries).toEqual([
        {
          id: 'root',
          title: 'Guide',
          path: '/docs/guide',
          deletedAt: root.deletedAt,
          deletedBy: { id: 'u1', displayName: 'Name of u1' },
          descendantCount: 2,
        },
      ]);
    });

    it('returns a null deleter for entries deleted before the trash existed', async () => {
      pageTrashRepository.findDeletionRoots.mockResolvedValue([
        trashedRoot({ deletedById: null }),
      ]);
      allowDelete();
      pageTrashRepository.countBatches.mockResolvedValue(
        new Map([['root', 1]]),
      );

      const [entry] = await service.listTrash('me');

      expect(entry.deletedBy).toBeNull();
      expect(entry.descendantCount).toBe(0);
      expect(entry.path).toBe('/guide');
    });

    it('keeps the entry when its deleter account no longer exists', async () => {
      pageTrashRepository.findDeletionRoots.mockResolvedValue([trashedRoot()]);
      allowDelete();
      usersService.findById.mockImplementation((id: string) =>
        id === 'u1'
          ? Promise.reject(new Error('gone'))
          : Promise.resolve(buildUser({ id })),
      );

      const [entry] = await service.listTrash('me');

      expect(entry.deletedBy).toBeNull();
    });
  });

  describe('restore', () => {
    it('restores the whole batch and emits a tree change', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(trashedRoot());
      allowDelete();

      await service.restore('root', 'me');

      expect(pageTrashRepository.restoreBatch).toHaveBeenCalledWith('root');
      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
      expect(userActivityLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          action: 'page.trash_restored',
          targetId: 'root',
        }),
      );
    });

    it('rejects a page that is not a deletion root', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(
        trashedRoot({ deletionRootId: 'someone-else' }),
      );

      await expect(service.restore('root', 'me')).rejects.toBeInstanceOf(
        PageNotInTrashException,
      );
    });

    it('rejects a page that is not in the trash', async () => {
      await expect(service.restore('root', 'me')).rejects.toBeInstanceOf(
        PageNotInTrashException,
      );
    });

    it('rejects without page.delete on the page', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(trashedRoot());
      permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
        new Map([['root', ['page.read']]]),
      );

      await expect(service.restore('root', 'me')).rejects.toBeInstanceOf(
        InsufficientPagePermissionException,
      );
      expect(pageTrashRepository.restoreBatch).not.toHaveBeenCalled();
    });

    it('rejects when the parent is still in the trash', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(
        trashedRoot({ parentId: 'parent' }),
      );
      allowDelete();
      pageTrashRepository.findByIdWithDeleted.mockResolvedValue(
        buildPage({ id: 'parent', deletedAt: new Date() }),
      );

      await expect(service.restore('root', 'me')).rejects.toBeInstanceOf(
        ParentInTrashException,
      );
      expect(pageTrashRepository.restoreBatch).not.toHaveBeenCalled();
    });

    it('rejects when a live page took the slug', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(trashedRoot());
      allowDelete();
      pagesRepository.findBySlugAndParent.mockResolvedValue(
        buildPage({ id: 'new', slug: 'guide' }),
      );

      await expect(service.restore('root', 'me')).rejects.toBeInstanceOf(
        SlugAlreadyExistsException,
      );
      expect(pageTrashRepository.restoreBatch).not.toHaveBeenCalled();
    });

    it('maps a duplicate-entry race to SlugAlreadyExistsException', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(trashedRoot());
      allowDelete();
      pageTrashRepository.restoreBatch.mockRejectedValue(
        new QueryFailedError('UPDATE', [], {
          code: 'ER_DUP_ENTRY',
        } as unknown as Error),
      );

      await expect(service.restore('root', 'me')).rejects.toBeInstanceOf(
        SlugAlreadyExistsException,
      );
    });
  });

  describe('purge', () => {
    it('purges the root and every trashed descendant, including separately deleted ones', async () => {
      pageTrashRepository.findTrashedById.mockResolvedValue(trashedRoot());
      pageTrashRepository.findTrashedSubtreeIds.mockResolvedValue([
        'root',
        'child',
        'older-deleted-grandchild',
      ]);

      await service.purge('root', 'admin-id');

      expect(pageTrashRepository.purge).toHaveBeenCalledWith([
        'root',
        'child',
        'older-deleted-grandchild',
      ]);
      expect(userActivityLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'page.purged',
          metadata: expect.objectContaining({ pageCount: 3 }) as unknown,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
    });

    it('rejects a page that is not a trashed deletion root', async () => {
      await expect(service.purge('root', 'admin-id')).rejects.toBeInstanceOf(
        PageNotInTrashException,
      );
      expect(pageTrashRepository.purge).not.toHaveBeenCalled();
    });
  });
});
