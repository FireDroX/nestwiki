import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service.js';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
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

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepository: {
    [K in keyof CommentsRepository]: Mock<CommentsRepository[K]>;
  };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };

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
    };
    eventEmitter = { emit: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: 'CommentsRepository', useValue: commentsRepository },
        { provide: PagesService, useValue: {} },
        { provide: UsersService, useValue: { findById: vi.fn() } },
        {
          provide: PermissionsService,
          useValue: { hasGlobal: vi.fn().mockResolvedValue(true) },
        },
        { provide: AdminAuditLogService, useValue: { record: vi.fn() } },
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
});
