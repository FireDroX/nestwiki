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
import { ReservedSlugException } from '../../common/exceptions/pages/reserved-slug.exception.js';
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
import {
  PAGE_CREATED_EVENT,
  PageCreatedEvent,
} from '../events/page-created.event.js';
import {
  PAGE_MOVED_EVENT,
  PageMovedEvent,
} from '../events/page-moved.event.js';
import {
  PAGE_PUBLISHED_EVENT,
  PagePublishedEvent,
} from '../events/page-published.event.js';
import {
  PAGE_TRASHED_EVENT,
  PageTrashedEvent,
} from '../events/page-trashed.event.js';
import { PAGE_TREE_CHANGED_EVENT } from '../events/page-tree-changed.event.js';
import { PAGE_VERSION_CREATED_EVENT } from '../events/page-version-created.event.js';
import type { PageFollowRepository } from '../persistence/page-follow.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { PageLinksService } from './page-links.service.js';
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
    visibility: 'public',
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
  let pageLinksService: {
    syncPage: Mock<PageLinksService['syncPage']>;
    findBrokenTargets: Mock<PageLinksService['findBrokenTargets']>;
    findLinkingPageIds: Mock<PageLinksService['findLinkingPageIds']>;
    rewriteAfterMove: Mock<PageLinksService['rewriteAfterMove']>;
  };

  beforeEach(async () => {
    pagesRepository = {
      findById: vi.fn(),
      findBySlugAndParent: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
      findVersionById: vi.fn(),
      findCurrentVersions: vi.fn(),
      createWithFirstVersion: vi.fn(),
      updateWithNewVersion: vi.fn(),
      updateParent: vi.fn(),
      findChildren: vi.fn(),
      softDeleteBatch: vi.fn(),
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
        segments: [{ type: 'ok', lines: mine.split('\n') }],
      })),
    };
    eventEmitter = { emit: vi.fn() };
    userActivityLogService = { record: vi.fn().mockResolvedValue(undefined) };
    pageLinksService = {
      syncPage: vi.fn().mockResolvedValue(undefined),
      findBrokenTargets: vi.fn().mockResolvedValue([]),
      findLinkingPageIds: vi.fn().mockResolvedValue([]),
      rewriteAfterMove: vi.fn().mockResolvedValue({
        linksUpdated: 0,
        pagesUpdated: 0,
        pagesSkipped: 0,
      }),
    };

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
        { provide: PageLinksService, useValue: pageLinksService },
      ],
    }).compile();

    service = module.get(PagesService);
  });

  function arrangeConflict() {
    const page = buildPage({ currentVersionId: 'version-2' });
    const baseVersion = buildVersion({ id: 'version-1', content: 'base' });
    const currentVersion = buildVersion({
      id: 'version-2',
      content: 'theirs',
      authorId: 'other-user',
      createdAt: new Date('2026-10-11T10:00:00Z'),
    });
    const segments = [
      {
        type: 'conflict' as const,
        mine: ['mine'],
        base: ['base'],
        theirs: ['theirs'],
      },
    ];
    pagesRepository.findById.mockResolvedValue(page);
    pagesRepository.findVersionById.mockImplementation((id: string) =>
      Promise.resolve(id === 'version-1' ? baseVersion : currentVersion),
    );
    pageMergeService.merge.mockReturnValue({
      conflict: true,
      content: '<<<<<<<',
      segments,
    });
    return { page, currentVersion, segments };
  }

  function removeCurrentVersionAuthor() {
    usersService.findById.mockImplementation((id: string) =>
      id === 'other-user'
        ? Promise.reject(new Error('gone'))
        : Promise.resolve(buildUser({ id })),
    );
  }

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

    it('returns the merge segments and the current version author on conflict', async () => {
      const { page, currentVersion, segments } = arrangeConflict();

      const result = await service.updatePage(
        page.id,
        { content: 'mine', baseVersionId: 'version-1' },
        'user-1',
      );

      expect(result).toMatchObject({
        conflict: true,
        mergedContent: '<<<<<<<',
        segments,
        currentVersionAuthorName: 'User',
        currentVersionCreatedAt: currentVersion.createdAt,
        currentVersionContent: currentVersion.content,
      });
      expect(pagesRepository.updateWithNewVersion).not.toHaveBeenCalled();
    });

    it('returns a null author name when the current version author no longer exists', async () => {
      const { page, currentVersion, segments } = arrangeConflict();
      removeCurrentVersionAuthor();

      const result = await service.updatePage(
        page.id,
        { content: 'mine', baseVersionId: 'version-1' },
        'user-1',
      );

      expect(result).toMatchObject({
        conflict: true,
        mergedContent: '<<<<<<<',
        segments,
        currentVersionAuthorName: null,
        currentVersionCreatedAt: currentVersion.createdAt,
        currentVersionContent: currentVersion.content,
      });
      expect(pagesRepository.updateWithNewVersion).not.toHaveBeenCalled();
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

    it('returns the segments and the current version author on conflict', async () => {
      const { currentVersion, segments } = arrangeConflict();

      const result = await service.mergePreview(
        'page-1',
        'version-1',
        'mine',
        'user-1',
      );

      expect(result).toEqual({
        conflict: true,
        mergedContent: '<<<<<<<',
        newBaseVersionId: 'version-2',
        segments,
        currentVersionAuthorName: 'User',
        currentVersionCreatedAt: currentVersion.createdAt,
        currentVersionContent: currentVersion.content,
      });
    });

    it('returns a null author name on conflict when the author no longer exists', async () => {
      arrangeConflict();
      removeCurrentVersionAuthor();

      const result = await service.mergePreview(
        'page-1',
        'version-1',
        'mine',
        'user-1',
      );

      expect(result.currentVersionAuthorName).toBeNull();
    });

    it('omits the segments when there is no conflict', async () => {
      const page = buildPage({ currentVersionId: 'version-2' });
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockImplementation((id: string) =>
        Promise.resolve(
          buildVersion({ id, content: id === 'version-1' ? 'base' : 'theirs' }),
        ),
      );

      const result = await service.mergePreview(
        'page-1',
        'version-1',
        'mine',
        'user-1',
      );

      expect(result.conflict).toBe(false);
      expect(result).not.toHaveProperty('segments');
      expect(result).not.toHaveProperty('currentVersionAuthorName');
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

    it('throws ReservedSlugException when moving a "stats" page directly under a root page', async () => {
      const page = buildPage({ id: pageId, slug: 'stats', parentId: childId });
      const root = buildPage({ id: otherId, parentId: null });

      pagesRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(id === pageId ? page : id === otherId ? root : null),
      );
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());

      await expect(
        service.movePage(pageId, { newParentId: otherId }, 'user-1'),
      ).rejects.toBeInstanceOf(ReservedSlugException);
      expect(pagesRepository.updateParent).not.toHaveBeenCalled();
    });

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

    describe('updating the links', () => {
      const docs = buildPage({ id: otherId, slug: 'docs', title: 'Docs' });
      const guide = buildPage({
        id: pageId,
        slug: 'guide',
        title: 'Guide',
        parentId: otherId,
      });
      const archive = buildPage({ id: childId, slug: 'archive' });

      beforeEach(() => {
        const pages = [docs, guide, archive];
        pagesRepository.findById.mockImplementation((id: string) =>
          Promise.resolve(pages.find((p) => p.id === id) ?? null),
        );
        pagesRepository.findAll.mockResolvedValue(pages);
        pagesRepository.findVersionById.mockResolvedValue(buildVersion());
        pagesRepository.findBySlugAndParent.mockResolvedValue(null);
        pagesRepository.updateParent.mockImplementation((page, parentId) =>
          Promise.resolve({ ...page, parentId }),
        );
      });

      it('rewrites the links from the old path to the new one when asked', async () => {
        pageLinksService.rewriteAfterMove.mockResolvedValue({
          linksUpdated: 12,
          pagesUpdated: 4,
          pagesSkipped: 1,
        });

        const result = await service.movePage(
          pageId,
          { newParentId: childId, updateLinks: true },
          'user-1',
        );

        expect(pageLinksService.rewriteAfterMove).toHaveBeenCalledWith(
          { from: '/docs/guide', to: '/archive/guide' },
          'Guide',
          expect.objectContaining({ id: 'user-1' }),
        );
        expect(
          pagesRepository.updateParent.mock.invocationCallOrder[0],
        ).toBeLessThan(
          pageLinksService.rewriteAfterMove.mock.invocationCallOrder[0],
        );
        expect(result.links).toEqual({
          linksUpdated: 12,
          pagesUpdated: 4,
          pagesSkipped: 1,
        });
      });

      it("returns the moved page's new version when its own links were rewritten", async () => {
        pageLinksService.rewriteAfterMove.mockImplementation(() => {
          pagesRepository.findById.mockResolvedValue({
            ...guide,
            parentId: childId,
            currentVersionId: 'version-2',
          });
          return Promise.resolve({
            linksUpdated: 1,
            pagesUpdated: 1,
            pagesSkipped: 0,
          });
        });
        pagesRepository.findVersionById.mockImplementation((id: string) =>
          Promise.resolve(buildVersion({ id })),
        );

        const result = await service.movePage(
          pageId,
          { newParentId: childId, updateLinks: true },
          'user-1',
        );

        expect(result.page.currentVersionId).toBe('version-2');
        expect(result.version.id).toBe('version-2');
      });

      it('computes the new path of a page moved to the root', async () => {
        await service.movePage(
          pageId,
          { newParentId: null, updateLinks: true },
          'user-1',
        );

        expect(pageLinksService.rewriteAfterMove).toHaveBeenCalledWith(
          { from: '/docs/guide', to: '/guide' },
          'Guide',
          expect.anything(),
        );
      });

      it('announces the move with the old and the new path', async () => {
        await service.movePage(pageId, { newParentId: childId }, 'user-1');

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          PAGE_MOVED_EVENT,
          new PageMovedEvent(pageId, 'user-1', '/docs/guide', '/archive/guide'),
        );
      });

      it('leaves the links alone by default', async () => {
        const result = await service.movePage(
          pageId,
          { newParentId: childId },
          'user-1',
        );

        expect(pageLinksService.rewriteAfterMove).not.toHaveBeenCalled();
        expect(result.links).toEqual({
          linksUpdated: 0,
          pagesUpdated: 0,
          pagesSkipped: 0,
        });
      });

      it('rejects an updateLinks that is not a boolean', async () => {
        await expect(
          service.movePage(
            pageId,
            { newParentId: childId, updateLinks: 'yes' as unknown as boolean },
            'user-1',
          ),
        ).rejects.toBeInstanceOf(ValidationException);
        expect(pagesRepository.updateParent).not.toHaveBeenCalled();
      });
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

    it('announces the new page', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      pagesRepository.createWithFirstVersion.mockResolvedValue({
        page: buildPage({ id: 'new-1' }),
        version: buildVersion({ id: 'v-new' }),
      });

      await service.createPage(
        { slug: 'new', title: 'New', content: 'x', visibility: 'public' },
        'user-1',
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAGE_CREATED_EVENT,
        new PageCreatedEvent('new-1', 'user-1'),
      );
    });

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
      expect(result).toEqual({ ...created, brokenLinks: [] });
    });

    it.each(['tree', 'trash'])(
      'throws ReservedSlugException for a root page named "%s"',
      async (slug) => {
        await expect(
          service.createPage({ ...dto, slug }, 'user-1'),
        ).rejects.toBeInstanceOf(ReservedSlugException);
        expect(pagesRepository.createWithFirstVersion).not.toHaveBeenCalled();
      },
    );

    it.each([
      'versions',
      'comments',
      'tags',
      'access-rules',
      'stats',
      'backlinks',
    ])(
      'throws ReservedSlugException for "%s" directly under a root page',
      async (slug) => {
        pagesRepository.findById.mockResolvedValue(
          buildPage({ id: 'root-1', parentId: null }),
        );

        await expect(
          service.createPage({ ...dto, slug, parentId: 'root-1' }, 'user-1'),
        ).rejects.toBeInstanceOf(ReservedSlugException);
        expect(pagesRepository.createWithFirstVersion).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['stats', 'at the root', undefined],
      ['tree', 'under a root page', 'root-1'],
      ['stats', 'deeper in the tree', 'child-1'],
    ])(
      'allows "%s" %s, where it does not collide with any route',
      async (slug, _where, parentId) => {
        pagesRepository.findById.mockImplementation((id: string) =>
          Promise.resolve(
            id === 'root-1'
              ? buildPage({ id: 'root-1', parentId: null })
              : buildPage({ id: 'child-1', parentId: 'root-1' }),
          ),
        );
        pagesRepository.findBySlugAndParent.mockResolvedValue(null);
        pagesRepository.createWithFirstVersion.mockResolvedValue({
          page: buildPage({ slug }),
          version: buildVersion(),
        });

        await service.createPage({ ...dto, slug, parentId }, 'user-1');

        expect(pagesRepository.createWithFirstVersion).toHaveBeenCalled();
      },
    );

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

  describe('findPublicByPath', () => {
    it('returns the page and its ancestors for a publicly readable page without touching the view count', async () => {
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
      pagesRepository.findBySlugAndParent.mockImplementation(
        (slug: string, parentId: string | null) => {
          if (slug === 'docs' && parentId === null)
            return Promise.resolve(parent);
          if (slug === 'guide' && parentId === 'parent-1')
            return Promise.resolve(child);
          return Promise.resolve(null);
        },
      );
      permissionsService.can.mockResolvedValue(true);
      const version = buildVersion({ id: child.currentVersionId! });
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.findPublicByPath(['docs', 'guide']);

      expect(result).toEqual({ page: child, version, ancestors: [parent] });
      expect(permissionsService.can).toHaveBeenCalledWith(
        undefined,
        'page.read',
        child.id,
      );
      expect(pagesRepository.incrementViewCount).not.toHaveBeenCalled();
    });

    it('never exposes private ancestors of a public page', async () => {
      const privateRoot = buildPage({
        id: 'root-1',
        slug: 'secret',
        title: 'Projet Secret',
        visibility: 'private',
      });
      const publicMiddle = buildPage({
        id: 'middle-1',
        slug: 'equipe',
        parentId: 'root-1',
      });
      const publicLeaf = buildPage({
        id: 'leaf-1',
        slug: 'planning',
        parentId: 'middle-1',
      });
      const pagesBySlug: Record<string, Page> = {
        secret: privateRoot,
        equipe: publicMiddle,
        planning: publicLeaf,
      };
      pagesRepository.findBySlugAndParent.mockImplementation((slug: string) =>
        Promise.resolve(pagesBySlug[slug] ?? null),
      );
      permissionsService.can.mockResolvedValue(true);

      pagesRepository.findVersionById.mockResolvedValue(buildVersion());

      const result = await service.findPublicByPath([
        'secret',
        'equipe',
        'planning',
      ]);

      expect(result?.page).toBe(publicLeaf);
      expect(result?.ancestors).toEqual([publicMiddle]);
    });

    it('returns null for an empty path', async () => {
      expect(await service.findPublicByPath([])).toBeNull();
    });

    it('returns null when a segment does not exist', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);

      expect(await service.findPublicByPath(['missing'])).toBeNull();
    });

    it('returns null when the current version cannot be found', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(buildPage());
      permissionsService.can.mockResolvedValue(true);
      pagesRepository.findVersionById.mockResolvedValue(null);

      expect(await service.findPublicByPath(['home'])).toBeNull();
    });

    it('returns null for a page that is not readable anonymously', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(
        buildPage({ visibility: 'private' }),
      );
      permissionsService.can.mockResolvedValue(false);

      expect(await service.findPublicByPath(['secret'])).toBeNull();
    });
  });

  describe('getReadableWithCurrentVersion', () => {
    it('returns a readable page and its current version without touching the view count', async () => {
      const page = buildPage({ viewCount: 4 });
      const version = buildVersion({ id: page.currentVersionId! });
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(version);

      const result = await service.getReadableWithCurrentVersion(
        page.id,
        member,
      );

      expect(result).toEqual({ page, version });
      expect(page.viewCount).toBe(4);
      expect(pagesRepository.incrementViewCount).not.toHaveBeenCalled();
    });

    it('throws PageAccessForbiddenException for a private page and no permission', async () => {
      pagesRepository.findById.mockResolvedValue(
        buildPage({ visibility: 'private' }),
      );
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.getReadableWithCurrentVersion('page-1'),
      ).rejects.toBeInstanceOf(PageAccessForbiddenException);
    });

    it('throws PageNotFoundException for an unknown page', async () => {
      pagesRepository.findById.mockResolvedValue(null);

      await expect(
        service.getReadableWithCurrentVersion('nope', member),
      ).rejects.toBeInstanceOf(PageNotFoundException);
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
      expect(pagesRepository.softDeleteBatch).not.toHaveBeenCalled();
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
      permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
        new Map([['child', ['page.delete']]]),
      );

      await service.deletePage('parent', { cascade: 'true' }, 'user-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PAGE_TRASHED_EVENT,
        new PageTrashedEvent('parent', 'user-1', 1),
      );

      expect(
        permissionsService.getEffectivePageActionsBulk,
      ).toHaveBeenCalledWith(expect.anything(), ['child']);
      expect(pagesRepository.softDeleteBatch).toHaveBeenCalledWith(
        ['parent', 'child'],
        'user-1',
        'parent',
      );
    });

    it('refuses a cascade delete when the user cannot delete one of the descendants', async () => {
      const parent = buildPage({ id: 'parent' });
      const child = buildPage({ id: 'child', parentId: 'parent' });

      pagesRepository.findById.mockResolvedValue(parent);
      pagesRepository.findChildren.mockImplementation((id: string) =>
        Promise.resolve(id === 'parent' ? [child] : []),
      );
      permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
        new Map([['child', []]]),
      );

      await expect(
        service.deletePage('parent', { cascade: 'true' }, 'user-1'),
      ).rejects.toBeInstanceOf(InsufficientPagePermissionException);
      expect(pagesRepository.softDeleteBatch).not.toHaveBeenCalled();
    });

    it('soft-deletes a leaf page without cascade', async () => {
      pagesRepository.findById.mockResolvedValue(buildPage({ id: 'leaf' }));
      pagesRepository.findChildren.mockResolvedValue([]);

      await service.deletePage('leaf', {}, 'user-1');

      expect(pagesRepository.softDeleteBatch).toHaveBeenCalledWith(
        ['leaf'],
        'user-1',
        'leaf',
      );
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
        new PagePublishedEvent(page.id, page.slug, page.title, 'user-1'),
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

  describe('link index', () => {
    it('indexes the links of a new page and reports the broken ones', async () => {
      const created = {
        page: buildPage({ id: 'new-1' }),
        version: buildVersion({ id: 'v-new', content: '[x](/pages/gone)' }),
      };
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      pagesRepository.createWithFirstVersion.mockResolvedValue(created);
      pageLinksService.findBrokenTargets.mockResolvedValue(['/gone']);

      const result = await service.createPage(
        {
          slug: 'new',
          title: 'New',
          content: '[x](/pages/gone)',
          visibility: 'public',
        },
        'user-1',
      );

      expect(pageLinksService.syncPage).toHaveBeenCalledWith(
        'new-1',
        'v-new',
        '[x](/pages/gone)',
      );
      expect(pageLinksService.findBrokenTargets).toHaveBeenCalledWith(
        '[x](/pages/gone)',
        expect.objectContaining({ id: 'user-1' }),
      );
      expect(result.brokenLinks).toEqual(['/gone']);
    });

    it('still returns the created page when the broken links cannot be checked', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(null);
      pagesRepository.createWithFirstVersion.mockResolvedValue({
        page: buildPage({ id: 'new-1' }),
        version: buildVersion({ id: 'v-new' }),
      });
      pageLinksService.findBrokenTargets.mockRejectedValue(new Error('down'));

      const result = await service.createPage(
        { slug: 'new', title: 'New', content: 'x', visibility: 'public' },
        'user-1',
      );

      expect(result.page.id).toBe('new-1');
      expect(result.brokenLinks).toEqual([]);
    });

    it('indexes the links of a saved version and reports the broken ones', async () => {
      const page = buildPage();
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, currentVersionId: 'version-2' },
        version: buildVersion({ id: 'version-2', content: 'saved' }),
      });
      pageLinksService.findBrokenTargets.mockResolvedValue(['/old']);

      const result = await service.updatePage(
        'page-1',
        { content: 'saved' },
        'user-1',
      );

      expect(pageLinksService.syncPage).toHaveBeenCalledWith(
        'page-1',
        'version-2',
        'saved',
      );
      expect(pageLinksService.findBrokenTargets).toHaveBeenCalledWith(
        'saved',
        expect.objectContaining({ id: 'user-1' }),
      );
      expect(result.brokenLinks).toEqual(['/old']);
    });

    it('still reports a saved version when the broken links cannot be checked', async () => {
      const page = buildPage();
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(buildVersion());
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, currentVersionId: 'version-2' },
        version: buildVersion({ id: 'version-2', content: 'saved' }),
      });
      pageLinksService.findBrokenTargets.mockRejectedValue(new Error('down'));

      const result = await service.updatePage(
        'page-1',
        { content: 'saved' },
        'user-1',
      );

      expect(result.version.id).toBe('version-2');
      expect(result.brokenLinks).toEqual([]);
    });

    it('leaves the index untouched when a save ends in a conflict', async () => {
      arrangeConflict();

      const result = await service.updatePage(
        'page-1',
        { content: 'mine', baseVersionId: 'version-1' },
        'user-1',
      );

      expect(result.conflict).toBe(true);
      expect(pageLinksService.syncPage).not.toHaveBeenCalled();
    });

    it('indexes the links of a restored version', async () => {
      const page = buildPage();
      pagesRepository.findById.mockResolvedValue(page);
      pagesRepository.updateWithNewVersion.mockResolvedValue({
        page: { ...page, currentVersionId: 'version-3' },
        version: buildVersion({ id: 'version-3', content: 'restored' }),
      });

      await service.createNewVersionFromContent(
        'page-1',
        'restored',
        'user-1',
        null,
      );

      expect(pageLinksService.syncPage).toHaveBeenCalledWith(
        'page-1',
        'version-3',
        'restored',
      );
    });

    it('reports the broken links of a page read by its path', async () => {
      const page = buildPage({ slug: 'docs' });
      pagesRepository.findBySlugAndParent.mockResolvedValue(page);
      pagesRepository.findVersionById.mockResolvedValue(
        buildVersion({ content: '[x](/pages/gone)' }),
      );
      pageLinksService.findBrokenTargets.mockResolvedValue(['/gone']);

      const result = await service.findByPath(['docs'], member);

      expect(pageLinksService.findBrokenTargets).toHaveBeenCalledWith(
        '[x](/pages/gone)',
        expect.objectContaining({ id: member.id }),
      );
      expect(result.brokenLinks).toEqual(['/gone']);
    });

    it('checks the broken links of a page read anonymously as an anonymous reader', async () => {
      pagesRepository.findBySlugAndParent.mockResolvedValue(
        buildPage({ slug: 'docs' }),
      );
      pagesRepository.findVersionById.mockResolvedValue(
        buildVersion({ content: '[x](/pages/hr)' }),
      );

      await service.findByPath(['docs']);

      expect(pageLinksService.findBrokenTargets).toHaveBeenCalledWith(
        '[x](/pages/hr)',
        undefined,
      );
    });
  });

  describe('getBacklinks', () => {
    const docs = buildPage({ id: 'docs', slug: 'docs', title: 'Docs' });
    const guide = buildPage({
      id: 'guide',
      slug: 'guide',
      parentId: 'docs',
      title: 'Guide',
    });
    const faq = buildPage({ id: 'faq', slug: 'faq', title: 'FAQ' });
    const secret = buildPage({
      id: 'secret',
      slug: 'secret',
      title: 'Secret',
      visibility: 'private',
    });

    beforeEach(() => {
      pagesRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(
          [docs, guide, faq, secret].find((page) => page.id === id) ?? null,
        ),
      );
      pagesRepository.findAll.mockResolvedValue([docs, guide, faq, secret]);
      pageLinksService.findLinkingPageIds.mockResolvedValue([
        'faq',
        'secret',
        'guide',
      ]);
    });

    it('lists the readable pages linking to the page with their path, sorted by title', async () => {
      permissionsService.filterReadable.mockImplementation(
        (_user: User | undefined, pages: Page[]) =>
          Promise.resolve(pages.filter((page) => page.id !== 'secret')),
      );

      const backlinks = await service.getBacklinks('docs', {}, member);

      expect(pageLinksService.findLinkingPageIds).toHaveBeenCalledWith(
        '/docs',
        false,
      );
      expect(backlinks).toEqual([
        {
          id: 'faq',
          title: 'FAQ',
          path: '/faq',
          updatedAt: faq.updatedAt,
        },
        {
          id: 'guide',
          title: 'Guide',
          path: '/docs/guide',
          updatedAt: guide.updatedAt,
        },
      ]);
    });

    it('lists the page itself with subtree=true when it links to its own sub-pages', async () => {
      pageLinksService.findLinkingPageIds.mockResolvedValue(['docs', 'faq']);

      const backlinks = await service.getBacklinks(
        'docs',
        { subtree: 'true' },
        member,
      );

      expect(backlinks.map((backlink) => backlink.id)).toEqual(['docs', 'faq']);
    });

    it('never lists the page itself otherwise', async () => {
      pageLinksService.findLinkingPageIds.mockResolvedValue(['docs', 'faq']);

      const backlinks = await service.getBacklinks('docs', {}, member);

      expect(backlinks.map((backlink) => backlink.id)).toEqual(['faq']);
    });

    it('includes the links to the descendants when subtree=true', async () => {
      await service.getBacklinks('docs', { subtree: 'true' }, member);

      expect(pageLinksService.findLinkingPageIds).toHaveBeenCalledWith(
        '/docs',
        true,
      );
    });

    it('throws PageNotFoundException for an unknown page', async () => {
      await expect(
        service.getBacklinks('missing', {}, member),
      ).rejects.toBeInstanceOf(PageNotFoundException);
    });

    it('throws PageAccessForbiddenException when the page itself is not readable', async () => {
      permissionsService.can.mockResolvedValue(false);

      await expect(
        service.getBacklinks('secret', {}, undefined),
      ).rejects.toBeInstanceOf(PageAccessForbiddenException);
      expect(pageLinksService.findLinkingPageIds).not.toHaveBeenCalled();
    });

    it('resolves the page from its path', async () => {
      pagesRepository.findBySlugAndParent.mockImplementation(
        (slug: string, parentId: string | null) =>
          Promise.resolve(
            slug === 'docs' && parentId === null
              ? docs
              : slug === 'guide' && parentId === 'docs'
                ? guide
                : null,
          ),
      );
      pageLinksService.findLinkingPageIds.mockResolvedValue(['faq']);

      const backlinks = await service.getBacklinksByPath(
        ['docs', 'guide'],
        member,
      );

      expect(pageLinksService.findLinkingPageIds).toHaveBeenCalledWith(
        '/docs/guide',
        false,
      );
      expect(backlinks.map((backlink) => backlink.id)).toEqual(['faq']);
      expect(pagesRepository.incrementViewCount).not.toHaveBeenCalled();
    });
  });
});
