import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError } from 'typeorm';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PageNotInTrashException } from '../../common/exceptions/pages/page-not-in-trash.exception.js';
import { ParentInTrashException } from '../../common/exceptions/pages/parent-in-trash.exception.js';
import { ParentPageNotFoundException } from '../../common/exceptions/pages/parent-page-not-found.exception.js';
import { SlugAlreadyExistsException } from '../../common/exceptions/pages/slug-already-exists.exception.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { TrashEntryResponseDto } from '../dto/out/trash-entry-response.dto.js';
import { Page } from '../entities/page.entity.js';
import { PAGE_TREE_CHANGED_EVENT } from '../events/page-tree-changed.event.js';
import type { PageTrashRepository } from '../persistence/page-trash.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';

const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

interface Deleter {
  id: string;
  displayName: string;
}

@Injectable()
export class PageTrashService {
  constructor(
    @Inject('PageTrashRepository')
    private readonly pageTrashRepository: PageTrashRepository,
    @Inject('PagesRepository')
    private readonly pagesRepository: PagesRepository,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userActivityLogService: UserActivityLogService,
  ) {}

  async listTrash(userId: string): Promise<TrashEntryResponseDto[]> {
    const user = await this.usersService.findById(userId);
    const roots = await this.pageTrashRepository.findDeletionRoots();
    const deletable = await this.filterDeletable(user, roots);
    const batchSizes = await this.pageTrashRepository.countBatches(
      deletable.map((page) => page.id),
    );
    const deleters = await this.resolveDeleters(deletable);

    return Promise.all(
      deletable.map(async (page) => ({
        id: page.id,
        title: page.title,
        path: await this.buildPath(page),
        deletedAt: page.deletedAt as Date,
        deletedBy: page.deletedById
          ? (deleters.get(page.deletedById) ?? null)
          : null,
        descendantCount: Math.max((batchSizes.get(page.id) ?? 1) - 1, 0),
      })),
    );
  }

  async restore(id: string, userId: string): Promise<void> {
    const page = await this.findDeletionRootOrFail(id);
    const user = await this.usersService.findById(userId);
    if ((await this.filterDeletable(user, [page])).length === 0) {
      throw new InsufficientPagePermissionException();
    }
    await this.assertParentIsLive(page);
    if (
      await this.pagesRepository.findBySlugAndParent(page.slug, page.parentId)
    ) {
      throw new SlugAlreadyExistsException();
    }

    try {
      await this.pageTrashRepository.restoreBatch(page.id);
    } catch (error) {
      if (PageTrashService.isDuplicateEntryError(error)) {
        throw new SlugAlreadyExistsException();
      }
      throw error;
    }

    void this.userActivityLogService.record({
      userId,
      action: 'page.restored',
      targetType: 'page',
      targetId: page.id,
      metadata: { title: page.title },
    });
    this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
  }

  async purge(id: string, userId: string): Promise<void> {
    const page = await this.findDeletionRootOrFail(id);
    const pageIds = await this.pageTrashRepository.findTrashedSubtreeIds(
      page.id,
    );
    await this.pageTrashRepository.purge(pageIds);

    void this.userActivityLogService.record({
      userId,
      action: 'page.purged',
      targetType: 'page',
      targetId: page.id,
      metadata: { title: page.title, pageCount: pageIds.length },
    });
    this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
  }

  private async findDeletionRootOrFail(id: string): Promise<Page> {
    const page = await this.pageTrashRepository.findTrashedById(id);
    if (!page || page.deletionRootId !== page.id) {
      throw new PageNotInTrashException();
    }
    return page;
  }

  private async filterDeletable(user: User, pages: Page[]): Promise<Page[]> {
    const actions = await this.permissionsService.getEffectivePageActionsBulk(
      user,
      pages.map((page) => page.id),
      { includeDeleted: true },
    );
    return pages.filter((page) =>
      (actions.get(page.id) ?? []).includes('page.delete'),
    );
  }

  private async assertParentIsLive(page: Page): Promise<void> {
    if (page.parentId === null) {
      return;
    }
    const parent = await this.pageTrashRepository.findByIdWithDeleted(
      page.parentId,
    );
    if (!parent) {
      throw new ParentPageNotFoundException();
    }
    if (parent.deletedAt) {
      throw new ParentInTrashException();
    }
  }

  private async buildPath(page: Page): Promise<string> {
    const segments = [page.slug];
    let parentId = page.parentId;
    while (parentId !== null) {
      const parent =
        await this.pageTrashRepository.findByIdWithDeleted(parentId);
      if (!parent) {
        break;
      }
      segments.unshift(parent.slug);
      parentId = parent.parentId;
    }
    return `/${segments.join('/')}`;
  }

  private async resolveDeleters(pages: Page[]): Promise<Map<string, Deleter>> {
    const deleterIds = new Set(
      pages
        .map((page) => page.deletedById)
        .filter((deleterId): deleterId is string => deleterId !== null),
    );
    const deleters = new Map<string, Deleter>();
    for (const deleterId of deleterIds) {
      try {
        const deleter = await this.usersService.findById(deleterId);
        deleters.set(deleterId, {
          id: deleterId,
          displayName: deleter.displayName,
        });
      } catch {
        continue;
      }
    }
    return deleters;
  }

  private static isDuplicateEntryError(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as { driverError?: { code?: string } }).driverError?.code ===
        MYSQL_DUPLICATE_ENTRY_CODE
    );
  }
}
