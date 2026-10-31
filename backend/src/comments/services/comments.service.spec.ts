import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { CommentNotFoundException } from '../../common/exceptions/comments/comment-not-found.exception.js';
import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import { CommentsDisabledException } from '../../common/exceptions/pages/comments-disabled.exception.js';
import { PageAccessForbiddenException } from '../../common/exceptions/pages/page-access-forbidden.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { CreateCommentDto } from '../dto/in/create-comment.dto.js';
import { UpdateCommentDto } from '../dto/in/update-comment.dto.js';
import { Comment } from '../entities/comment.entity.js';
import { CommentMapper } from '../mapper/comment.mapper.js';
import { COMMENT_CHANGED_EVENT } from '../events/comment-changed.event.js';
import {
  COMMENT_CREATED_EVENT,
  CommentCreatedEvent,
} from '../events/comment-created.event.js';
import type { CommentsRepository } from '../persistence/comment.repository.js';
import { CommentsService } from './comments.service.js';

const author: AuthenticatedUser = {
  id: 'user-1',
  email: 'e@x.com',
  role: 'member',
};

function buildComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    pageId: 'page-1',
    authorId: 'user-1',
    parentId: null,
    content: 'hello',
    editedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildTargetUser(overrides: Partial<User> = {}): User {
  return {
    id: 'target-1',
    email: 'target@example.com',
    passwordHash: 'hash',
    displayName: 'Target User',
    avatarExtension: null,
    role: 'member',
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepository: {
    [K in keyof CommentsRepository]: Mock<CommentsRepository[K]>;
  };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let adminAuditLogService: { record: ReturnType<typeof vi.fn> };
  let usersService: { findById: ReturnType<typeof vi.fn> };
  let pagesService: {
    getByIdOrFail: ReturnType<typeof vi.fn>;
    getAncestorPath: ReturnType<typeof vi.fn>;
  };
  let permissionsService: {
    hasGlobal: ReturnType<typeof vi.fn>;
    getEffectivePageActionsBulk: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commentsRepository = {
      findById: vi.fn(),
      findAllByPageId: vi.fn(),
      findRepliesByParentId: vi.fn(),
      create: vi.fn(),
      updateContent: vi.fn(),
      softDelete: vi.fn(),
      deleteMany: vi.fn(),
      findAllByAuthorId: vi.fn(),
      findAllIdsByAuthorId: vi.fn(),
      findByIdsAndAuthorId: vi.fn(),
      countByAuthorId: vi.fn(),
      countByPageId: vi.fn(),
    };
    eventEmitter = { emit: vi.fn() };
    adminAuditLogService = { record: vi.fn() };
    usersService = {
      findById: vi.fn().mockResolvedValue(buildTargetUser()),
    };
    pagesService = {
      getByIdOrFail: vi
        .fn()
        .mockResolvedValue({ id: 'page-1', commentsEnabled: true }),
      getAncestorPath: vi.fn().mockResolvedValue('docs/page-1'),
    };
    permissionsService = {
      hasGlobal: vi.fn().mockResolvedValue(true),
      getEffectivePageActionsBulk: vi.fn().mockResolvedValue(new Map()),
    };

    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: 'CommentsRepository', useValue: commentsRepository },
        { provide: PagesService, useValue: pagesService },
        { provide: UsersService, useValue: usersService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: AdminAuditLogService, useValue: adminAuditLogService },
        {
          provide: UserActivityLogService,
          useValue: { record: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  it('emits COMMENT_CHANGED_EVENT with the pageId after creating a comment', async () => {
    commentsRepository.create.mockResolvedValue(buildComment());
    const dto: CreateCommentDto = { content: 'hello' };

    await service.createComment('page-1', dto, author);

    expect(eventEmitter.emit).toHaveBeenCalledWith(COMMENT_CHANGED_EVENT, {
      pageId: 'page-1',
    });
  });

  it('emits COMMENT_CREATED_EVENT after creating a comment', async () => {
    commentsRepository.create.mockResolvedValue(buildComment());

    await service.createComment('page-1', { content: 'hello' }, author);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      COMMENT_CREATED_EVENT,
      new CommentCreatedEvent(buildComment().id, 'page-1', author.id),
    );
  });

  it('emits COMMENT_CHANGED_EVENT with the pageId after editing a comment', async () => {
    const comment = buildComment();
    commentsRepository.findById.mockResolvedValue(comment);
    commentsRepository.updateContent.mockResolvedValue({
      ...comment,
      content: 'edited',
    });
    const dto: UpdateCommentDto = { content: 'edited' };

    await service.updateComment('comment-1', dto, author);

    expect(eventEmitter.emit).toHaveBeenCalledWith(COMMENT_CHANGED_EVENT, {
      pageId: 'page-1',
    });
  });

  it('emits COMMENT_CHANGED_EVENT with the pageId after an author deletes their own comment', async () => {
    const comment = buildComment();
    commentsRepository.findById.mockResolvedValue(comment);
    commentsRepository.softDelete.mockResolvedValue(comment);

    await service.deleteComment('comment-1', author);

    expect(eventEmitter.emit).toHaveBeenCalledWith(COMMENT_CHANGED_EVENT, {
      pageId: 'page-1',
    });
  });

  it('emits COMMENT_CHANGED_EVENT with the pageId when a moderator hard-deletes a comment', async () => {
    const comment = buildComment({ authorId: 'someone-else' });
    const admin: AuthenticatedUser = {
      id: 'admin-1',
      email: 'a@x.com',
      role: 'admin',
    };
    commentsRepository.findById.mockResolvedValue(comment);
    commentsRepository.findRepliesByParentId.mockResolvedValue([]);
    commentsRepository.deleteMany.mockResolvedValue(undefined);

    await service.deleteComment('comment-1', admin);

    expect(eventEmitter.emit).toHaveBeenCalledWith(COMMENT_CHANGED_EVENT, {
      pageId: 'page-1',
    });
  });

  it('records an audit entry when a non-admin comment.moderate holder deletes a comment', async () => {
    const comment = buildComment({ authorId: 'someone-else' });
    const moderator: AuthenticatedUser = {
      id: 'moderator-1',
      email: 'm@x.com',
      role: 'member',
    };
    commentsRepository.findById.mockResolvedValue(comment);
    commentsRepository.findRepliesByParentId.mockResolvedValue([]);
    commentsRepository.deleteMany.mockResolvedValue(undefined);

    await service.deleteComment('comment-1', moderator);

    expect(adminAuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'moderator-1',
        action: 'comment.deleted_by_moderator',
        targetType: 'Comment',
        targetId: 'comment-1',
        metadata: { pageId: 'page-1', count: 1, ids: ['comment-1'] },
      }),
    );
  });

  describe('listByUser / purgeByUser admin-target guard', () => {
    const nonAdminActor: AuthenticatedUser = {
      id: 'moderator-1',
      email: 'm@x.com',
      role: 'member',
    };

    it('blocks a non-admin user.manage holder from listing an admin target’s comments', async () => {
      usersService.findById.mockResolvedValue(
        buildTargetUser({ role: 'admin' }),
      );

      await expect(
        service.listByUser('target-1', {}, nonAdminActor),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(commentsRepository.findAllByAuthorId).not.toHaveBeenCalled();
    });

    it('blocks a non-admin user.manage holder from purging an admin target’s comments', async () => {
      usersService.findById.mockResolvedValue(
        buildTargetUser({ role: 'admin' }),
      );

      await expect(
        service.purgeByUser('target-1', {}, nonAdminActor),
      ).rejects.toBeInstanceOf(InsufficientPermissionException);
      expect(commentsRepository.deleteMany).not.toHaveBeenCalled();
    });

    it('allows a non-admin user.manage holder to list/purge a non-admin target’s comments', async () => {
      usersService.findById.mockResolvedValue(
        buildTargetUser({ role: 'member' }),
      );
      commentsRepository.findAllByAuthorId.mockResolvedValue({
        items: [],
        total: 0,
      });
      commentsRepository.findAllIdsByAuthorId.mockResolvedValue([]);

      await expect(
        service.listByUser('target-1', {}, nonAdminActor),
      ).resolves.toEqual(expect.objectContaining({ items: [], total: 0 }));
      await expect(
        service.purgeByUser('target-1', {}, nonAdminActor),
      ).resolves.toBe(0);
    });
  });

  describe('listByUser content of unreadable pages', () => {
    const moderator: AuthenticatedUser = {
      id: 'moderator-1',
      email: 'm@x.com',
      role: 'member',
    };

    beforeEach(() => {
      commentsRepository.findAllByAuthorId.mockResolvedValue({
        items: [
          buildComment({ id: 'c-secret', pageId: 'secret', content: 'secret' }),
          buildComment({ id: 'c-open', pageId: 'open', content: 'visible' }),
        ],
        total: 2,
      });
      permissionsService.getEffectivePageActionsBulk.mockResolvedValue(
        new Map([
          ['secret', []],
          ['open', ['page.read']],
        ]),
      );
    });

    it('hides the content and page of a comment on a page the actor cannot read', async () => {
      const result = await service.listByUser('target-1', {}, moderator);

      const secret = result.items.find(
        (item) => item.comment.id === 'c-secret',
      );
      expect(secret).toEqual(
        expect.objectContaining({ pageReadable: false, pagePath: null }),
      );
      expect(pagesService.getByIdOrFail).not.toHaveBeenCalledWith(
        'secret',
        expect.anything(),
      );
      const dto = CommentMapper.toUserCommentResponseDto(secret!);
      expect(dto.content).toBeNull();
      expect(dto.pageId).toBeNull();
    });

    it('keeps the content of a comment on a readable page', async () => {
      const result = await service.listByUser('target-1', {}, moderator);

      const open = result.items.find((item) => item.comment.id === 'c-open');
      expect(CommentMapper.toUserCommentResponseDto(open!).content).toBe(
        'visible',
      );
    });

    it('shows everything to an admin', async () => {
      const result = await service.listByUser(
        'target-1',
        {},
        {
          id: 'admin-1',
          email: 'a@x.com',
          role: 'admin',
        },
      );

      expect(result.items.every((item) => item.pageReadable)).toBe(true);
      expect(
        permissionsService.getEffectivePageActionsBulk,
      ).not.toHaveBeenCalled();
    });

    it('shows an author all of their own comments', async () => {
      const result = await service.listByUser(
        'moderator-1',
        {},
        moderator,
        true,
      );

      expect(result.items.every((item) => item.pageReadable)).toBe(true);
    });
  });

  describe('updateComment access checks', () => {
    it('rejects editing a soft-deleted comment', async () => {
      commentsRepository.findById.mockResolvedValue(
        buildComment({ deletedAt: new Date(), content: '' }),
      );

      await expect(
        service.updateComment('comment-1', { content: 'back' }, author),
      ).rejects.toBeInstanceOf(CommentNotFoundException);
      expect(commentsRepository.updateContent).not.toHaveBeenCalled();
    });

    it('rejects an author who lost page.read on the page', async () => {
      commentsRepository.findById.mockResolvedValue(buildComment());
      pagesService.getByIdOrFail.mockRejectedValue(
        new PageAccessForbiddenException(),
      );

      await expect(
        service.updateComment('comment-1', { content: 'edited' }, author),
      ).rejects.toBeInstanceOf(PageAccessForbiddenException);
      expect(pagesService.getByIdOrFail).toHaveBeenCalledWith('page-1', author);
      expect(commentsRepository.updateContent).not.toHaveBeenCalled();
    });

    it('rejects editing when comments are disabled on the page', async () => {
      commentsRepository.findById.mockResolvedValue(buildComment());
      pagesService.getByIdOrFail.mockResolvedValue({
        id: 'page-1',
        commentsEnabled: false,
      });

      await expect(
        service.updateComment('comment-1', { content: 'edited' }, author),
      ).rejects.toBeInstanceOf(CommentsDisabledException);
      expect(commentsRepository.updateContent).not.toHaveBeenCalled();
    });
  });
});
