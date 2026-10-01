import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { CircularReferenceException } from '../../common/exceptions/pages/circular-reference.exception.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PageAccessForbiddenException } from '../../common/exceptions/pages/page-access-forbidden.exception.js';
import { PageHasChildrenException } from '../../common/exceptions/pages/page-has-children.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { ParentPageNotFoundException } from '../../common/exceptions/pages/parent-page-not-found.exception.js';
import { SlugAlreadyExistsException } from '../../common/exceptions/pages/slug-already-exists.exception.js';
import { VersionNotFoundException } from '../../common/exceptions/pages/version-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { ChangeVisibilityDto } from '../dto/in/change-visibility.dto.js';
import { CreatePageDto } from '../dto/in/create-page.dto.js';
import { MovePageDto } from '../dto/in/move-page.dto.js';
import { SetCommentsEnabledDto } from '../dto/in/set-comments-enabled.dto.js';
import { UpdatePageDto } from '../dto/in/update-page.dto.js';
import { Page } from '../entities/page.entity.js';
import { PageVersion } from '../entities/page-version.entity.js';
import { PAGE_PUBLISHED_EVENT } from '../events/page-published.event.js';
import { PAGE_TREE_CHANGED_EVENT } from '../events/page-tree-changed.event.js';
import { PAGE_VERSION_CREATED_EVENT } from '../events/page-version-created.event.js';
import type { PageFollowRepository } from '../persistence/page-follow.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { PageMergeService } from './page-merge.service.js';
import { PagesService } from './pages.service.js';

const member: AuthenticatedUser = {
  id: 'r1',
  email: 'r@x.com',
  role: 'member',
};
const pageEditor: AuthenticatedUser = {
  id: 'e1',
  email: 'e@x.com',
  role: 'member',
};
const admin: AuthenticatedUser = {
  id: 'a1',
  email: 'a@x.com',
  role: 'admin',
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    passwordHash: 'hash',
    role: 'member',
    avatarUrl: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
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

function buildVersion(overrides: Partial<PageVersion> = {}): PageVersion {
  return {
    id: 'version-1',
    pageId: 'page-1',
    content: 'original content',
    title: 'Home',
    authorId: 'user-1',
    changeSummary: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('PagesService', () => {
  let service: PagesService;
  let pagesRepository: {
    [K in keyof PagesRepository]: Mock<PagesRepository[K]>;
  };
  let pageFollowRepository: {
    [K in keyof PageFollowRepository]: Mock<PageFollowRepository[K]>;
  };
  let permissionsService: {
    can: Mock<PermissionsService['can']>;
    hasGlobal: Mock<PermissionsService['hasGlobal']>;
    filterReadable: Mock<PermissionsService['filterReadable']>;
    getEffectivePageActions: Mock<
      PermissionsService['getEffectivePageActions']
    >;
    getEffectivePageActionsBulk: Mock<
      PermissionsService['getEffectivePageActionsBulk']
    >;
  };
  let usersService: { findById: Mock<UsersService['findById']> };
  let pageMergeService: { merge: ReturnType<typeof vi.fn> };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let userActivityLogService: { record: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pagesRepository = {
      findById: vi.fn(),
      findBySlugAndParent: vi.fn(),
      findAll: vi.fn(),
      findVersionById: vi.fn(),
      createWithFirstVersion: vi.fn(),
      updateWithNewVersion: vi.fn(),
      updateParent: vi.fn(),
      findChildren: vi.fn(),
      softDelete: vi.fn(),
      updateVisibility: vi.fn(),
      updateCommentsEnabled: vi.fn(),
      countCreatedByUser: vi.fn(),
      countVersionsByAuthor: vi.fn(),
      incrementViewCount: vi.fn(),
      findTopPublicByViewCount: vi.fn(),
    };
    pageFollowRepository = {
      follow: vi.fn(),
      unfollow: vi.fn(),
      findFollowedPageIds: vi.fn(),
      isFollowing: vi.fn().mockResolvedValue(false),
    };
    permissionsService = {
      can: vi.fn().mockResolvedValue(true),
      hasGlobal: vi.fn().mockResolvedValue(true),
      filterReadable: vi
        .fn()
        .mockImplementation((_user: User | undefined, pages: Page[]) =>
          Promise.resolve(pages),
        ),
      getEffectivePageActions: vi.fn().mockResolvedValue([]),
      getEffectivePageActionsBulk: vi
        .fn()
        .mockImplementation((_user: User | undefined, pageIds: string[]) =>
          Promise.resolve(new Map(pageIds.map((id) => [id, []]))),
        ),
    };
    usersService = {
      findById: vi
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(
            buildUser({ id, role: id === admin.id ? 'admin' : 'member' }),
          ),
        ),
    };
    pageMergeService = {
      merge: vi.fn().mockImplementation((base: string, mine: string) => ({
        conflict: false,
        content: mine,
      })),
    };
    eventEmitter = { emit: vi.fn() };
    userActivityLogService = { record: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: 'PagesRepository', useValue: pagesRepository },
        { provide: 'PageFollowsRepository', useValue: pageFollowRepository },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: UsersService, useValue: usersService },
        { provide: PageMergeService, useValue: pageMergeService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: UserActivityLogService, useValue: userActivityLogService },
      ],
    }).compile();

    service = module.get(PagesService);
  });

  describe('updatePage', () => {
    it('creates a new PageVersion and never mutates the existing one', async () => {
      const page = buildPage();
      const currentVersion = buildVersion();
      const dto: UpdatePageDto = { content: 'updated content' };
      const newVersion = buildVersion({
        id: 'version-2',
        content: 'updated content',
      });

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(currentVersion);
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, currentVersionId: 'version-2' },
        version: newVersion,
      });

      const result = await service.updatePage('page-1', dto, 'user-1');

      expect(pagesRepository.updateWithNewVersion).toHaveBeenCalledWith({
        page,
        title: page.title,
        content: 'updated content',
        changeSummary: null,
        authorId: 'user-1',
      });
      expect(currentVersion.content).toBe('original content');
      expect(result.version.id).toBe('version-2');
      expect(result.page.currentVersionId).toBe('version-2');
    });

    it('throws PageNotFoundException when the page does not exist', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.updatePage('missing', {}, 'user-1'),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });

    it('throws InsufficientPagePermissionException when the user cannot edit', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage());
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.updatePage('page-1', {}, 'user-2'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(permissionsService.can).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-2' }),
        'page.edit',
        'page-1',
      );
      expect(pagesRepository.updateWithNewVersion).not.toHaveBeenCalled();
    });

    it('emits PAGE_VERSION_CREATED_EVENT after a successful save', async () => {
      const page = buildPage();
      const currentVersion = buildVersion();
      const dto: UpdatePageDto = { content: 'updated content' };
      const newVersion = buildVersion({
        id: 'version-2',
        content: 'updated content',
      });
      const updatedPage = { ...page, currentVersionId: 'version-2' };

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(currentVersion);
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: updatedPage,
        version: newVersion,
      });

      await service.updatePage('page-1', dto, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAGE_VERSION_CREATED_EVENT,
        expect.objectContaining({
          pageId: updatedPage.id,
          versionId: 'version-2',
          authorId: 'user-1',
          content: 'updated content',
        }),
      );
    });

    it('merges cleanly and persists when baseVersionId is stale but non-conflicting', async () => {
      const page = buildPage({ currentVersionId: 'version-2' });
      const baseVersion = buildVersion({
        id: 'version-1',
        content: 'Line 1\nLine 2\nLine 3',
      });
      const currentVersion = buildVersion({
        id: 'version-2',
        content: 'Line 1\nLine 2\nLine 3 edited by them',
      });
      const newVersion = buildVersion({
        id: 'version-3',
        content: 'Line 1 edited by me\nLine 2\nLine 3 edited by them',
      });

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'version-1'
            ? baseVersion
            : id === 'version-2'
              ? currentVersion
              : null,
        ),
      );
      pageMergeService.merge.mockImplementation(() =>
        new PageMergeService().merge(
          baseVersion.content,
          'Line 1 edited by me\nLine 2\nLine 3',
          currentVersion.content,
        ),
      );
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, currentVersionId: 'version-3' },
        version: newVersion,
      });

      const dto: UpdatePageDto = {
        content: 'Line 1 edited by me\nLine 2\nLine 3',
        baseVersionId: 'version-1',
      };
      const result = await service.updatePage('page-1', dto, 'user-1');

      expect(result.conflict).toBe(false);
      expect(pagesRepository.updateWithNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Line 1 edited by me\nLine 2\nLine 3 edited by them',
          changeSummary: 'Fusion automatique',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAGE_VERSION_CREATED_EVENT,
        expect.anything(),
      );
    });

    it('does not persist and returns a conflict when both sides edited the same line', async () => {
      const page = buildPage({ currentVersionId: 'version-2' });
      const baseVersion = buildVersion({
        id: 'version-1',
        content: 'Line 1\nLine 2\nLine 3',
      });
      const currentVersion = buildVersion({
        id: 'version-2',
        content: 'Line 1\nLine 2 edited by them\nLine 3',
      });

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'version-1'
            ? baseVersion
            : id === 'version-2'
              ? currentVersion
              : null,
        ),
      );
      pageMergeService.merge.mockImplementation(() =>
        new PageMergeService().merge(
          baseVersion.content,
          'Line 1\nLine 2 edited by me\nLine 3',
          currentVersion.content,
        ),
      );

      const dto: UpdatePageDto = {
        content: 'Line 1\nLine 2 edited by me\nLine 3',
        baseVersionId: 'version-1',
      };
      const result = await service.updatePage('page-1', dto, 'user-1');

      expect(result.conflict).toBe(true);
      expect(result.mergedContent).toContain('<<<<<<<');
      expect(result.page).toBe(page);
      expect(result.version).toBe(currentVersion);
      expect(pagesRepository.updateWithNewVersion).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('skips merging entirely when baseVersionId matches the current version', async () => {
      const page = buildPage();
      const currentVersion = buildVersion();
      const dto: UpdatePageDto = {
        content: 'updated content',
        baseVersionId: page.currentVersionId!,
      };
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(currentVersion);
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page,
        version: currentVersion,
      });

      await service.updatePage('page-1', dto, 'user-1');

      expect(pageMergeService.merge).not.toHaveBeenCalled();
    });

    it('emits PAGE_TREE_CHANGED_EVENT only when the title actually changes', async () => {
      const page = buildPage({ title: 'Old title' });
      const currentVersion = buildVersion();

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(currentVersion);
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, title: 'New title' },
        version: buildVersion({ id: 'version-2' }),
      });

      await service.updatePage('page-1', { title: 'New title' }, 'user-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);

      eventEmitter.emit.mockClear();
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page,
        version: buildVersion({ id: 'version-3' }),
      });

      await service.updatePage(
        'page-1',
        { content: 'only content changed' },
        'user-1',
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        PAGE_TREE_CHANGED_EVENT,
      );
    });
  });

  describe('createNewVersionFromContent', () => {
    it('creates a new version from the given content when the user can restore', async () => {
      const page = buildPage();
      const newVersion = buildVersion({
        id: 'version-2',
        content: 'restored content',
      });
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, currentVersionId: 'version-2' },
        version: newVersion,
      });

      const result = await service.createNewVersionFromContent(
        'page-1',
        'restored content',
        'user-1',
        'Restored from version version-0',
      );

      expect(permissionsService.can).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'page.restore_version',
        'page-1',
      );
      expect(pagesRepository.updateWithNewVersion).toHaveBeenCalledWith({
        page,
        title: page.title,
        content: 'restored content',
        changeSummary: 'Restored from version version-0',
        authorId: 'user-1',
      });
      expect(result.version.id).toBe('version-2');
    });

    it('throws PageNotFoundException when the page does not exist', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.createNewVersionFromContent(
          'missing',
          'content',
          'user-1',
          null,
        ),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });

    it('throws InsufficientPagePermissionException when the user lacks page.restore_version', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage());
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.createNewVersionFromContent(
          'page-1',
          'content',
          'user-2',
          null,
        ),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(permissionsService.can).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-2' }),
        'page.restore_version',
        'page-1',
      );
      expect(pagesRepository.updateWithNewVersion).not.toHaveBeenCalled();
    });
  });

  describe('mergePreview', () => {
    it('returns a clean merge without persisting anything', async () => {
      const page = buildPage({ currentVersionId: 'version-2' });
      const baseVersion = buildVersion({
        id: 'version-1',
        content: 'Line 1\nLine 2\nLine 3',
      });
      const currentVersion = buildVersion({
        id: 'version-2',
        content: 'Line 1\nLine 2\nLine 3 edited by them',
      });

      pagesRepository.findById.mockResolvedValue(page);
      pageMergeService.merge.mockImplementation(
        (base: string, mine: string, theirs: string) =>
          new PageMergeService().merge(base, mine, theirs),
      );
      pagesRepository.findVersionById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'version-1'
            ? baseVersion
            : id === 'version-2'
              ? currentVersion
              : null,
        ),
      );

      const result = await service.mergePreview(
        'page-1',
        'version-1',
        'Line 1 edited by me\nLine 2\nLine 3',
        'user-1',
      );

      expect(result).toEqual({
        conflict: false,
        mergedContent: 'Line 1 edited by me\nLine 2\nLine 3 edited by them',
        newBaseVersionId: 'version-2',
      });
      expect(pagesRepository.updateWithNewVersion).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('throws VersionNotFoundException when baseVersionId does not exist', async () => {
      const page = buildPage({ currentVersionId: 'version-2' });
      pagesRepository.findById.mockResolvedValue(page);
      pageMergeService.merge.mockImplementation(
        (base: string, mine: string, theirs: string) =>
          new PageMergeService().merge(base, mine, theirs),
      );
      pagesRepository.findVersionById.mockResolvedValue(null);

      await expect(
        service.mergePreview('page-1', 'missing-version', 'content', 'user-1'),
      ).rejects.toBeInstanceOf(VersionNotFoundException);
    });

    it('throws InsufficientPagePermissionException when the user cannot edit', async () => {
      const page = buildPage({ currentVersionId: 'version-2' });
      pagesRepository.findById.mockResolvedValue(page);
      pageMergeService.merge.mockImplementation(
        (base: string, mine: string, theirs: string) =>
          new PageMergeService().merge(base, mine, theirs),
      );
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.mergePreview('page-1', 'version-1', 'content', 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
    });

    it('throws VersionNotFoundException when baseVersionId belongs to a different page', async () => {
      const page = buildPage({ id: 'page-1', currentVersionId: 'version-2' });
      const currentVersion = buildVersion({
        id: 'version-2',
        pageId: 'page-1',
        content: 'Line 1\nLine 2\nLine 3 edited by them',
      });
      const otherPagesVersion = buildVersion({
        id: 'version-foreign',
        pageId: 'page-2',
        content: 'secret content from another page',
      });

      pagesRepository.findById.mockResolvedValue(page);
      pageMergeService.merge.mockImplementation(
        (base: string, mine: string, theirs: string) =>
          new PageMergeService().merge(base, mine, theirs),
      );
      pagesRepository.findVersionById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'version-foreign'
            ? otherPagesVersion
            : id === 'version-2'
              ? currentVersion
              : null,
        ),
      );

      await expect(
        service.mergePreview('page-1', 'version-foreign', 'content', 'user-1'),
      ).rejects.toBeInstanceOf(VersionNotFoundException);
      expect(pageMergeService.merge).not.toHaveBeenCalled();
    });
  });

  describe('movePage', () => {
    const pageId = '11111111-1111-1111-1111-111111111111';
    const childId = '22222222-2222-2222-2222-222222222222';
    const otherId = '33333333-3333-3333-3333-333333333333';

    it('detects a cycle when newParentId is a descendant of the page', async () => {
      const page = buildPage({ id: pageId, parentId: null });
      const child = buildPage({ id: childId, parentId: pageId });
      const dto: MovePageDto = { newParentId: childId };

      pagesRepository.findById.mockImplementation((id: string) => {
        if (id === pageId) return Promise.resolve(page);
        if (id === childId) return Promise.resolve(child);
        return Promise.resolve(null);
      });
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());

      await expect(
        service.movePage(pageId, dto, 'user-1'),
      ).rejects.toBeInstanceOf(CircularReferenceException);
      expect(pagesRepository.updateParent).not.toHaveBeenCalled();
    });

    it('moves the page when newParentId is not a descendant', async () => {
      const page = buildPage({ id: pageId, parentId: null });
      const target = buildPage({ id: otherId, parentId: null });
      const dto: MovePageDto = { newParentId: otherId };

      pagesRepository.findById.mockImplementation((id: string) => {
        if (id === pageId) return Promise.resolve(page);
        if (id === otherId) return Promise.resolve(target);
        return Promise.resolve(null);
      });
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      pagesRepository.updateParent.mockResolvedValue({
        ...page,
        parentId: otherId,
      });

      const result = await service.movePage(pageId, dto, 'user-1');

      expect(pagesRepository.updateParent).toHaveBeenCalledWith(page, otherId);
      expect(result.page.parentId).toBe(otherId);
    });

    it('emits PAGE_TREE_CHANGED_EVENT after moving a page', async () => {
      const page = buildPage({ id: pageId, parentId: null });
      const target = buildPage({ id: otherId, parentId: null });
      const dto: MovePageDto = { newParentId: otherId };

      pagesRepository.findById.mockImplementation((id: string) => {
        if (id === pageId) return Promise.resolve(page);
        if (id === otherId) return Promise.resolve(target);
        return Promise.resolve(null);
      });
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      pagesRepository.updateParent.mockResolvedValue({
        ...page,
        parentId: otherId,
      });

      await service.movePage(pageId, dto, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
    });

    it('throws ParentPageNotFoundException, not a permission error, when newParentId does not exist', async () => {
      const page = buildPage({ id: pageId, parentId: null });
      const dto: MovePageDto = { newParentId: otherId };

      pagesRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(id === pageId ? page : null),
      );
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      permissionsService.can.mockImplementation((_user, _action, id) =>
        Promise.resolve(id === pageId),
      );

      await expect(
        service.movePage(pageId, dto, 'user-1'),
      ).rejects.toBeInstanceOf(ParentPageNotFoundException);
      expect(permissionsService.can).not.toHaveBeenCalledWith(
        expect.anything(),
        'page.create_child',
        otherId,
      );
      expect(pagesRepository.updateParent).not.toHaveBeenCalled();
    });

    it('throws InsufficientPagePermissionException when the user cannot move the page', async () => {
      pagesRepository.findById.mockResolvedValue(
        buildPage({ id: pageId, parentId: null }),
      );
      permissionsService.can.mockImplementation((_user, action) =>
        Promise.resolve(action !== 'page.move'),
      );

      await expect(
        service.movePage(pageId, { newParentId: null }, 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(pagesRepository.updateParent).not.toHaveBeenCalled();
    });

    it('throws InsufficientPagePermissionException when the user cannot create a child under the destination', async () => {
      const page = buildPage({ id: pageId, parentId: null });
      const target = buildPage({ id: otherId, parentId: null });

      pagesRepository.findById.mockImplementation((id: string) => {
        if (id === pageId) return Promise.resolve(page);
        if (id === otherId) return Promise.resolve(target);
        return Promise.resolve(null);
      });
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      permissionsService.can.mockImplementation((_user, action) =>
        Promise.resolve(action !== 'page.create_child'),
      );

      await expect(
        service.movePage(pageId, { newParentId: otherId }, 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(pagesRepository.updateParent).not.toHaveBeenCalled();
    });

    it('requires the page.create_root global permission to move a page to the root', async () => {
      pagesRepository.findById.mockResolvedValue(
        buildPage({ id: pageId, parentId: otherId }),
      );
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      permissionsService.hasGlobal.mockResolvedValue(false);

      await expect(
        service.movePage(pageId, { newParentId: null }, 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(permissionsService.hasGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'page.create_root',
      );
      expect(pagesRepository.updateParent).not.toHaveBeenCalled();
    });
  });

  describe('createPage', () => {
    const dto: CreatePageDto = {
      slug: 'new-page',
      title: 'New page',
      content: 'content',
      visibility: 'public',
    };

    it('creates the page and its first version', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      const created = {
        page: buildPage({ slug: 'new-page' }),
        version: buildVersion(),
      };
      pagesRepository.createWithFirstVersion.mockResolvedValue(created);

      const result = await service.createPage(dto, 'user-1');

      expect(pagesRepository.createWithFirstVersion).toHaveBeenCalledWith({
        slug: 'new-page',
        title: 'New page',
        content: 'content',
        parentId: null,
        visibility: 'public',
        createdById: 'user-1',
      });
      expect(result).toBe(created);
    });

    it('throws ValidationException for an invalid slug', async () => {
      await expect(
        service.createPage({ ...dto, slug: 'Invalid Slug!' }, 'user-1'),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(pagesRepository.createWithFirstVersion).not.toHaveBeenCalled();
    });

    it('throws ParentPageNotFoundException when parentId does not resolve', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.createPage({ ...dto, parentId: 'missing-parent' }, 'user-1'),
      ).rejects.toBeInstanceOf(ParentPageNotFoundException);
    });

    it('throws SlugAlreadyExistsException when the slug is already taken at that level', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(buildPage());

      await expect(service.createPage(dto, 'user-1')).rejects.toBeInstanceOf(
        SlugAlreadyExistsException,
      );
    });

    it('throws InsufficientPagePermissionException when creating a root page without page.create_root', async () => {
      permissionsService.hasGlobal.mockResolvedValue(false);

      await expect(service.createPage(dto, 'user-1')).rejects.toBeInstanceOf(
        InsufficientPagePermissionException,
      );
      expect(permissionsService.hasGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'page.create_root',
      );
      expect(pagesRepository.createWithFirstVersion).not.toHaveBeenCalled();
    });

    it('throws InsufficientPagePermissionException when creating a child without page.create_child on the parent', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage({ id: 'parent-1' }));
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.createPage({ ...dto, parentId: 'parent-1' }, 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(permissionsService.can).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'page.create_child',
        'parent-1',
      );
      expect(pagesRepository.createWithFirstVersion).not.toHaveBeenCalled();
    });

    it('emits PAGE_TREE_CHANGED_EVENT after creating a page', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      pagesRepository.createWithFirstVersion.mockResolvedValue({
        page: buildPage({ slug: 'new-page' }),
        version: buildVersion(),
      });

      await service.createPage(dto, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
    });
  });

  describe('getTree', () => {
    it('returns every page when every page is readable', async () => {
      const pages = [buildPage({ id: 'p1', visibility: 'private' })];
      pagesRepository.findAll.mockResolvedValue(pages);

      const tree = await service.getTree(admin);

      expect(tree).toHaveLength(1);
    });

    it('builds the tree only from the pages PermissionsService deems readable for the full user record', async () => {
      const privatePage = buildPage({ id: 'p1', visibility: 'private' });
      const publicPage = buildPage({ id: 'p2', visibility: 'public' });
      pagesRepository.findAll.mockResolvedValue([privatePage, publicPage]);
      permissionsService.filterReadable.mockResolvedValue([publicPage]);

      const tree = await service.getTree(member);

      expect(usersService.findById).toHaveBeenCalledWith(member.id);
      expect(permissionsService.filterReadable).toHaveBeenCalledWith(
        expect.objectContaining({ id: member.id, role: 'member' }),
        [privatePage, publicPage],
      );
      expect(tree.map((node) => node.id)).toEqual(['p2']);
    });

    it('filters as an anonymous visitor without looking up a user', async () => {
      const pages = [buildPage({ id: 'p1', visibility: 'public' })];
      pagesRepository.findAll.mockResolvedValue(pages);

      await service.getTree(undefined);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(permissionsService.filterReadable).toHaveBeenCalledWith(
        undefined,
        pages,
      );
    });
  });

  describe('findByPath', () => {
    it('resolves a page by its full ancestor slug path', async () => {
      const parent = buildPage({
        id: 'parent-1',
        slug: 'docs',
        parentId: null,
      });
      const child = buildPage({
        id: 'child-1',
        slug: 'guide',
        parentId: 'parent-1',
      });
      const version = buildVersion({ id: child.currentVersionId! });

      pagesRepository.findBySlugAndParent.mockImplementation(
        (slug: string, parentId: string | null) => {
          if (slug === 'docs' && parentId === null)
            return Promise.resolve(parent);
          if (slug === 'guide' && parentId === 'parent-1')
            return Promise.resolve(child);
          return Promise.resolve(null);
        },
      );
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['docs', 'guide'], member);

      expect(result.page).toBe(child);
      expect(result.version).toBe(version);
    });

    it('throws PageNotFoundException for an empty path', async () => {
      await expect(service.findByPath([], member)).rejects.toBeInstanceOf(
        PageNotFoundException,
      );
    });

    it('throws PageAccessForbiddenException for a private page and no permission', async () => {
      const page = buildPage({ visibility: 'private' });
      permissionsService.can.mockResolvedValue(false);
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);

      await expect(
        service.findByPath(['secret'], member),
      ).rejects.toBeInstanceOf(PageAccessForbiddenException);
      expect(permissionsService.can).toHaveBeenCalledWith(
        expect.objectContaining({ id: member.id }),
        'page.read',
        page.id,
      );
    });

    it('allows a private page for a member whose access rule grants page.read', async () => {
      const page = buildPage({ visibility: 'private' });
      const version = buildVersion({ id: page.currentVersionId! });
      permissionsService.can.mockImplementation((_user, action) =>
        Promise.resolve(action === 'page.read'),
      );
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['secret'], member);

      expect(result.page).toBe(page);
    });

    it('increments the view count on each read', async () => {
      const page = buildPage({ viewCount: 4 });
      const version = buildVersion({ id: page.currentVersionId! });
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['home'], member);

      expect(pagesRepository.incrementViewCount).toHaveBeenCalledWith(page.id);
      expect(result.page.viewCount).toBe(5);
    });

    it('reports isFollowed for the current user', async () => {
      const page = buildPage();
      const version = buildVersion({ id: page.currentVersionId! });
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);
      pageFollowRepository.isFollowing.mockResolvedValue(true);

      const result = await service.findByPath(['home'], member);

      expect(pageFollowRepository.isFollowing).toHaveBeenCalledWith(
        member.id,
        page.id,
      );
      expect(result.isFollowed).toBe(true);
    });

    it('reports isFollowed as false for an anonymous visitor', async () => {
      const page = buildPage({ visibility: 'public' });
      const version = buildVersion({ id: page.currentVersionId! });
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['home'], undefined);

      expect(pageFollowRepository.isFollowing).not.toHaveBeenCalled();
      expect(result.isFollowed).toBe(false);
    });

    it('reports permissions from PermissionsService.getEffectivePageActions for the leaf page', async () => {
      const page = buildPage({ visibility: 'public' });
      const version = buildVersion({ id: page.currentVersionId! });
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
        'page.edit',
      ]);
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['home'], pageEditor);

      expect(permissionsService.getEffectivePageActions).toHaveBeenCalledWith(
        expect.objectContaining({ id: pageEditor.id }),
        page.id,
      );
      expect(result.permissions).toEqual(['page.read', 'page.edit']);
    });

    it('reports only the actions PermissionsService grants for a member without page.edit', async () => {
      const page = buildPage({ visibility: 'public' });
      const version = buildVersion({ id: page.currentVersionId! });
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['home'], member);

      expect(result.permissions).toEqual(['page.read']);
    });

    it('asks PermissionsService about the leaf page itself so a rule on an ancestor can grant page.edit', async () => {
      const page = buildPage({ visibility: 'public', parentId: 'parent-1' });
      const version = buildVersion({ id: page.currentVersionId! });
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
        'page.edit',
      ]);
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['docs', 'home'], member);

      expect(permissionsService.getEffectivePageActions).toHaveBeenCalledWith(
        expect.objectContaining({ id: member.id }),
        page.id,
      );
      expect(result.permissions).toContain('page.edit');
    });

    it('reports just page.read for an anonymous visitor on a public page', async () => {
      const page = buildPage({ visibility: 'public' });
      const version = buildVersion({ id: page.currentVersionId! });
      permissionsService.getEffectivePageActions.mockResolvedValue([
        'page.read',
      ]);
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findByPath(['home'], undefined);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(permissionsService.getEffectivePageActions).toHaveBeenCalledWith(
        undefined,
        page.id,
      );
      expect(result.permissions).toEqual(['page.read']);
    });
  });

  describe('listPopularPages', () => {
    it('returns the public pages with the most views', async () => {
      const pages = [buildPage({ id: 'page-1', viewCount: 10 })];
      pagesRepository.findTopPublicByViewCount.mockResolvedValue(pages);

      const result = await service.listPopularPages(5);

      expect(pagesRepository.findTopPublicByViewCount).toHaveBeenCalledWith(5);
      expect(result).toBe(pages);
    });
  });

  describe('listChildren / getByIdOrFail', () => {
    it('lists only the children PermissionsService deems readable', async () => {
      const parent = buildPage({ id: 'parent-1', visibility: 'public' });
      const c1 = buildPage({ id: 'c1', visibility: 'public' });
      const c2 = buildPage({ id: 'c2', visibility: 'private' });
      const c3 = buildPage({ id: 'c3', visibility: 'private' });
      pagesRepository.findById.mockResolvedValue(parent);
      pagesRepository.findChildren.mockResolvedValue([c1, c2, c3]);
      permissionsService.filterReadable.mockResolvedValue([c1, c2]);

      const children = await service.listChildren('parent-1', member);

      expect(permissionsService.filterReadable).toHaveBeenCalledWith(
        expect.objectContaining({ id: member.id }),
        [c1, c2, c3],
      );
      expect(children.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('throws PageNotFoundException when the parent does not exist', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.listChildren('missing', member),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });
  });

  describe('deletePage', () => {
    it('throws PageHasChildrenException when the page has children and cascade is not requested', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage());
      pagesRepository.findChildren.mockResolvedValue([
        buildPage({ id: 'child' }),
      ]);

      await expect(
        service.deletePage('page-1', {}, 'user-1'),
      ).rejects.toBeInstanceOf(PageHasChildrenException);
      expect(pagesRepository.softDelete).not.toHaveBeenCalled();
    });

    it('deletes recursively when cascade=true', async () => {
      const parent = buildPage({ id: 'parent' });
      const child = buildPage({ id: 'child', parentId: 'parent' });

      pagesRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'parent' ? parent : id === 'child' ? child : null,
        ),
      );
      pagesRepository.findChildren.mockImplementation((id: string) =>
        Promise.resolve(id === 'parent' ? [child] : []),
      );

      await service.deletePage('parent', { cascade: 'true' }, 'user-1');

      expect(pagesRepository.softDelete).toHaveBeenCalledWith('child');
      expect(pagesRepository.softDelete).toHaveBeenCalledWith('parent');
    });

    it('refuses a cascade delete when the user cannot delete one of the descendants', async () => {
      const parent = buildPage({ id: 'parent' });
      const child = buildPage({ id: 'child', parentId: 'parent' });

      pagesRepository.findById.mockResolvedValue(parent);
      pagesRepository.findChildren.mockImplementation((id: string) =>
        Promise.resolve(id === 'parent' ? [child] : []),
      );
      permissionsService.can.mockImplementation((_user, _action, id) =>
        Promise.resolve(id !== 'child'),
      );

      await expect(
        service.deletePage('parent', { cascade: 'true' }, 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(pagesRepository.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes a leaf page without cascade', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage({ id: 'leaf' }));
      pagesRepository.findChildren.mockResolvedValue([]);

      await service.deletePage('leaf', {}, 'user-1');

      expect(pagesRepository.softDelete).toHaveBeenCalledWith('leaf');
    });

    it('emits PAGE_TREE_CHANGED_EVENT after deleting a page', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage({ id: 'leaf' }));
      pagesRepository.findChildren.mockResolvedValue([]);

      await service.deletePage('leaf', {}, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
    });
  });

  describe('setVisibility', () => {
    it('emits PAGE_PUBLISHED_EVENT when a page becomes public', async () => {
      const page = buildPage({ visibility: 'private' });
      const version = buildVersion();
      const dto: ChangeVisibilityDto = { visibility: 'public' };

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);
      pagesRepository.updateVisibility.mockResolvedValue({
        ...page,
        visibility: 'public',
      });
      pagesRepository.findChildren.mockResolvedValue([]);

      await service.setVisibility('page-1', dto, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAGE_PUBLISHED_EVENT,
        expect.objectContaining({ pageId: page.id }),
      );
    });

    it('always emits PAGE_TREE_CHANGED_EVENT, but PAGE_PUBLISHED_EVENT only on a private→public transition', async () => {
      const page = buildPage({ visibility: 'public' });
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      pagesRepository.updateVisibility.mockResolvedValue(page);
      pagesRepository.findChildren.mockResolvedValue([]);

      await service.setVisibility('page-1', { visibility: 'public' }, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PAGE_TREE_CHANGED_EVENT);
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        PAGE_PUBLISHED_EVENT,
        expect.anything(),
      );
    });

    it('throws ValidationException for an invalid visibility value', async () => {
      await expect(
        service.setVisibility(
          'page-1',
          { visibility: 'invalid' } as unknown as ChangeVisibilityDto,
          'user-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('setCommentsEnabled', () => {
    it('updates commentsEnabled on the page', async () => {
      const page = buildPage({ commentsEnabled: true });
      const version = buildVersion();
      const dto: SetCommentsEnabledDto = { commentsEnabled: false };

      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);
      pagesRepository.updateCommentsEnabled.mockResolvedValue({
        ...page,
        commentsEnabled: false,
      });

      const result = await service.setCommentsEnabled('page-1', dto, 'user-1');

      expect(pagesRepository.updateCommentsEnabled).toHaveBeenCalledWith(
        page,
        false,
      );
      expect(result.page.commentsEnabled).toBe(false);
      expect(result.version).toBe(version);
    });

    it('throws PageNotFoundException when the page does not exist', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.setCommentsEnabled(
          'missing',
          { commentsEnabled: false },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });

    it('throws InsufficientPagePermissionException when the user cannot edit', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage());
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.setCommentsEnabled(
          'page-1',
          { commentsEnabled: false },
          'user-2',
        ),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(pagesRepository.updateCommentsEnabled).not.toHaveBeenCalled();
    });

    it('throws ValidationException when commentsEnabled is not a boolean', async () => {
      await expect(
        service.setCommentsEnabled(
          'page-1',
          { commentsEnabled: 'no' } as unknown as SetCommentsEnabledDto,
          'user-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('followPage', () => {
    it('follows an existing page', async () => {
      const page = buildPage();
      pagesRepository.findById.mockResolvedValue(page);

      await service.followPage(page.id, member);

      expect(pageFollowRepository.follow).toHaveBeenCalledWith(
        member.id,
        page.id,
      );
    });

    it('lets an admin follow a private page', async () => {
      const page = buildPage({ visibility: 'private' });
      pagesRepository.findById.mockResolvedValue(page);

      await service.followPage(page.id, admin);

      expect(permissionsService.can).toHaveBeenCalledWith(
        expect.objectContaining({ id: admin.id, role: 'admin' }),
        'page.read',
        page.id,
      );
      expect(pageFollowRepository.follow).toHaveBeenCalledWith(
        admin.id,
        page.id,
      );
    });

    it('lets a member whose access rule grants page.read follow a private page', async () => {
      const page = buildPage({ visibility: 'private' });
      pagesRepository.findById.mockResolvedValue(page);
      permissionsService.can.mockImplementation((_user, action) =>
        Promise.resolve(action === 'page.read'),
      );

      await service.followPage(page.id, member);

      expect(pageFollowRepository.follow).toHaveBeenCalledWith(
        member.id,
        page.id,
      );
    });

    it('rejects a member without a grant on a private page', async () => {
      const page = buildPage({ visibility: 'private' });
      pagesRepository.findById.mockResolvedValue(page);
      permissionsService.can.mockResolvedValue(false);

      await expect(service.followPage(page.id, member)).rejects.toBeInstanceOf(
        PageAccessForbiddenException,
      );
      expect(pageFollowRepository.follow).not.toHaveBeenCalled();
    });

    it('throws PageNotFoundException for a missing page', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.followPage('missing', member),
      ).rejects.toBeInstanceOf(PageNotFoundException);
      expect(pageFollowRepository.follow).not.toHaveBeenCalled();
    });
  });

  describe('unfollowPage', () => {
    it('delegates to the repository', async () => {
      await service.unfollowPage('page-1', 'user-1');

      expect(pageFollowRepository.unfollow).toHaveBeenCalledWith(
        'user-1',
        'page-1',
      );
    });
  });

  describe('getFollowedPages', () => {
    it('returns followed pages with their last activity date, most recent first', async () => {
      const older = buildPage({ id: 'page-1', currentVersionId: 'v1' });
      const newer = buildPage({ id: 'page-2', currentVersionId: 'v2' });
      const olderVersion = buildVersion({
        id: 'v1',
        createdAt: new Date('2026-01-01'),
      });
      const newerVersion = buildVersion({
        id: 'v2',
        createdAt: new Date('2026-02-01'),
      });
      pageFollowRepository.findFollowedPageIds.mockResolvedValue([
        'page-1',
        'page-2',
      ]);
      pagesRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(id === 'page-1' ? older : newer),
      );
      pagesRepository.findVersionById.mockImplementation((id: string) =>
        Promise.resolve(id === 'v1' ? olderVersion : newerVersion),
      );

      const result = await service.getFollowedPages(member);

      expect(result).toEqual([
        { page: newer, lastActivityAt: newerVersion.createdAt },
        { page: older, lastActivityAt: olderVersion.createdAt },
      ]);
    });

    it('returns an empty list when nothing is followed', async () => {
      pageFollowRepository.findFollowedPageIds.mockResolvedValue([]);

      const result = await service.getFollowedPages(member);

      expect(result).toEqual([]);
    });

    it('omits followed pages the user can no longer access', async () => {
      const publicPage = buildPage({ id: 'page-1', currentVersionId: 'v1' });
      const privatePage = buildPage({
        id: 'page-2',
        currentVersionId: 'v2',
        visibility: 'private',
      });
      pageFollowRepository.findFollowedPageIds.mockResolvedValue([
        'page-1',
        'page-2',
      ]);
      pagesRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(id === 'page-1' ? publicPage : privatePage),
      );
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      permissionsService.can.mockImplementation((_user, action, pageId) =>
        Promise.resolve(action === 'page.read' && pageId === 'page-1'),
      );

      const result = await service.getFollowedPages(member);

      expect(result.map((entry) => entry.page.id)).toEqual(['page-1']);
    });
  });
});
