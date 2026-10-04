import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { InsufficientPermissionException } from '../../common/exceptions/insufficient-permission.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { CreateCommentDto } from '../dto/in/create-comment.dto.js';
import { UpdateCommentDto } from '../dto/in/update-comment.dto.js';
import { Comment } from '../entities/comment.entity.js';
import { COMMENT_CHANGED_EVENT } from '../events/comment-changed.event.js';
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

    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: 'CommentsRepository', useValue: commentsRepository },
        { provide: PagesService, useValue: {} },
        { provide: UsersService, useValue: usersService },
        {
          provide: PermissionsService,
          useValue: { hasGlobal: vi.fn().mockResolvedValue(true) },
        },
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
});
