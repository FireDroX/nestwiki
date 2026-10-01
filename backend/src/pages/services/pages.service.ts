import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError } from 'typeorm';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { CircularReferenceException } from '../../common/exceptions/pages/circular-reference.exception.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { PageAccessForbiddenException } from '../../common/exceptions/pages/page-access-forbidden.exception.js';
import { PageHasChildrenException } from '../../common/exceptions/pages/page-has-children.exception.js';
import { PageNotFoundException } from '../../common/exceptions/pages/page-not-found.exception.js';
import { ParentPageNotFoundException } from '../../common/exceptions/pages/parent-page-not-found.exception.js';
import { SlugAlreadyExistsException } from '../../common/exceptions/pages/slug-already-exists.exception.js';
import { VersionNotFoundException } from '../../common/exceptions/pages/version-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { PageAction } from '../../common/permissions.js';
import {
  CHANGE_SUMMARY_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  SLUG_REGEX,
  TITLE_MAX_LENGTH,
  UUID_REGEX,
} from '../../common/variables.global.js';
import { ChangeVisibilityDto } from '../dto/in/change-visibility.dto.js';
import { CreatePageDto } from '../dto/in/create-page.dto.js';
import { DeletePageQueryDto } from '../dto/in/delete-page-query.dto.js';
import { MovePageDto } from '../dto/in/move-page.dto.js';
import { SetCommentsEnabledDto } from '../dto/in/set-comments-enabled.dto.js';
import { UpdatePageDto } from '../dto/in/update-page.dto.js';
import { FindByPathResultDto } from '../dto/out/find-by-path-result.dto.js';
import { PageMergePreviewResponseDto } from '../dto/out/page-merge-preview-response.dto.js';
import { PageTreeNodeDto } from '../dto/out/page-tree-node.dto.js';
import { UpdatePageResultDto } from '../dto/out/update-page-result.dto.js';
import { PageVersion } from '../entities/page-version.entity.js';
import { Page, PAGE_VISIBILITIES } from '../entities/page.entity.js';
import {
  PAGE_PUBLISHED_EVENT,
  PagePublishedEvent,
} from '../events/page-published.event.js';
import { PAGE_TREE_CHANGED_EVENT } from '../events/page-tree-changed.event.js';
import {
  PAGE_VERSION_CREATED_EVENT,
  PageVersionCreatedEvent,
} from '../events/page-version-created.event.js';
import { PageTreeMapper } from '../mapper/page-tree.mapper.js';
import type { PageFollowRepository } from '../persistence/page-follow.repository.js';
import type { PagesRepository } from '../persistence/page.repository.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { PageMergeService } from './page-merge.service.js';

const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

@Injectable()
export class PagesService {
  constructor(
    @Inject('PagesRepository')
    private readonly pagesRepository: PagesRepository,
    @Inject('PageFollowsRepository')
    private readonly pageFollowRepository: PageFollowRepository,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
    private readonly pageMergeService: PageMergeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userActivityLogService: UserActivityLogService,
  ) {}

  private async resolveFullUser(
    currentUser?: AuthenticatedUser,
  ): Promise<User | undefined> {
    if (!currentUser) {
      return undefined;
    }
    try {
      return await this.usersService.findById(currentUser.id);
    } catch {
      return undefined;
    }
  }

  async createPage(
    dto: CreatePageDto,
    createdById: string,
  ): Promise<{ page: Page; version: PageVersion }> {
    this.validateCreatePage(dto);

    const parentId = dto.parentId ?? null;
    const user = await this.usersService.findById(createdById);
    if (parentId !== null) {
      const parent = await this.pagesRepository.findById(parentId);
      if (!parent) {
        throw new ParentPageNotFoundException();
      }
      if (
        !(await this.permissionsService.can(
          user,
          'page.create_child',
          parentId,
        ))
      ) {
        throw new InsufficientPagePermissionException();
      }
    } else if (
      !(await this.permissionsService.hasGlobal(user, 'page.create_root'))
    ) {
      throw new InsufficientPagePermissionException();
    }

    const existing = await this.pagesRepository.findBySlugAndParent(
      dto.slug,
      parentId,
    );
    if (existing) {
      throw new SlugAlreadyExistsException();
    }

    try {
      const result = await this.pagesRepository.createWithFirstVersion({
        slug: dto.slug,
        title: dto.title,
        content: dto.content,
        parentId,
        visibility: dto.visibility,
        createdById,
      });
      void this.userActivityLogService.record({
        userId: createdById,
        action: 'page.created',
        targetType: 'page',
        targetId: result.page.id,
        metadata: { title: dto.title, slug: dto.slug },
      });
      this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
      return result;
    } catch (error) {
      if (PagesService.isDuplicateSlugError(error)) {
        throw new SlugAlreadyExistsException();
      }
      throw error;
    }
  }

  async getTree(currentUser?: AuthenticatedUser): Promise<PageTreeNodeDto[]> {
    const pages = await this.pagesRepository.findAll();
    const visible = await this.filterAccessible(pages, currentUser);

    return PageTreeMapper.buildTree(visible);
  }

  async findByPath(
    segments: string[],
    currentUser?: AuthenticatedUser,
  ): Promise<FindByPathResultDto> {
    if (segments.length === 0) {
      throw new PageNotFoundException();
    }

    let parentId: string | null = null;
    let page: Page | null = null;
    for (const slug of segments) {
      page = await this.pagesRepository.findBySlugAndParent(slug, parentId);
      if (!page) {
        throw new PageNotFoundException();
      }
      parentId = page.id;
    }

    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertAccessible(page, currentUser);

    const version = await this.pagesRepository.findVersionById(
      page.currentVersionId,
    );
    if (!version) {
      throw new PageNotFoundException();
    }

    await this.pagesRepository.incrementViewCount(page.id);
    page.viewCount += 1;

    const isFollowed = currentUser
      ? await this.pageFollowRepository.isFollowing(currentUser.id, page.id)
      : false;

    const canEdit = await this.permissionsService.can(
      await this.resolveFullUser(currentUser),
      'page.edit',
      page.id,
    );

    return { page, version, isFollowed, canEdit };
  }

  async getAncestorPath(page: Page): Promise<string> {
    const segments = [page.slug];
    let parentId = page.parentId;
    while (parentId !== null) {
      const parent: Page | null = await this.pagesRepository.findById(parentId);
      if (!parent) {
        break;
      }
      segments.unshift(parent.slug);
      parentId = parent.parentId;
    }
    return `/${segments.join('/')}`;
  }

  async listPopularPages(limit: number): Promise<Page[]> {
    return this.pagesRepository.findTopPublicByViewCount(limit);
  }

  async followPage(id: string, currentUser: AuthenticatedUser): Promise<void> {
    await this.getByIdOrFail(id, currentUser);
    await this.pageFollowRepository.follow(currentUser.id, id);
  }

  async unfollowPage(id: string, userId: string): Promise<void> {
    await this.pageFollowRepository.unfollow(userId, id);
  }

  async getFollowedPages(
    currentUser: AuthenticatedUser,
  ): Promise<{ page: Page; lastActivityAt: Date }[]> {
    const pageIds = await this.pageFollowRepository.findFollowedPageIds(
      currentUser.id,
    );

    const entries = await Promise.all(
      pageIds.map(async (pageId) => {
        const page = await this.pagesRepository.findById(pageId);
        if (!page || !page.currentVersionId) {
          return null;
        }
        if (!(await this.isAccessible(page, currentUser))) {
          return null;
        }
        const version = await this.pagesRepository.findVersionById(
          page.currentVersionId,
        );
        if (!version) {
          return null;
        }
        return { page, lastActivityAt: version.createdAt };
      }),
    );

    return entries
      .filter(
        (entry): entry is { page: Page; lastActivityAt: Date } =>
          entry !== null,
      )
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }

  async listChildren(
    parentId: string,
    currentUser?: AuthenticatedUser,
  ): Promise<Page[]> {
    await this.getByIdOrFail(parentId, currentUser);
    const children = await this.pagesRepository.findChildren(parentId);
    return this.filterAccessible(children, currentUser);
  }

  async getByIdOrFail(
    id: string,
    currentUser?: AuthenticatedUser,
  ): Promise<Page> {
    const page = await this.pagesRepository.findById(id);
    if (!page) {
      throw new PageNotFoundException();
    }

    await this.assertAccessible(page, currentUser);

    return page;
  }

  async createNewVersionFromContent(
    pageId: string,
    content: string,
    authorId: string,
    changeSummary: string | null,
  ): Promise<{ page: Page; version: PageVersion }> {
    const page = await this.pagesRepository.findById(pageId);
    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.restore_version', pageId, authorId);

    const result = await this.pagesRepository.updateWithNewVersion({
      page,
      title: page.title,
      content,
      changeSummary,
      authorId,
    });
    this.eventEmitter.emit(
      PAGE_VERSION_CREATED_EVENT,
      new PageVersionCreatedEvent(
        result.page.id,
        result.version.id,
        authorId,
        result.page.title,
        result.version.content,
        changeSummary,
        result.page.updatedAt,
      ),
    );
    void this.userActivityLogService.record({
      userId: authorId,
      action: 'page.restored',
      targetType: 'page',
      targetId: pageId,
      metadata: { changeSummary },
    });
    return result;
  }

  async updatePage(
    id: string,
    dto: UpdatePageDto,
    authorId: string,
  ): Promise<UpdatePageResultDto> {
    const page = await this.pagesRepository.findById(id);
    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.edit', id, authorId);

    const currentVersion = await this.pagesRepository.findVersionById(
      page.currentVersionId,
    );
    if (!currentVersion) {
      throw new PageNotFoundException();
    }

    this.validateUpdatePage(dto);

    const title = dto.title ?? page.title;
    let content = dto.content ?? currentVersion.content;
    let changeSummary = dto.changeSummary ?? null;

    if (dto.baseVersionId && dto.baseVersionId !== page.currentVersionId) {
      const baseVersion = await this.pagesRepository.findVersionById(
        dto.baseVersionId,
      );
      if (!baseVersion || baseVersion.pageId !== page.id) {
        throw new VersionNotFoundException();
      }

      const merged = this.pageMergeService.merge(
        baseVersion.content,
        content,
        currentVersion.content,
      );

      if (merged.conflict) {
        return {
          page,
          version: currentVersion,
          conflict: true,
          mergedContent: merged.content,
        };
      }

      content = merged.content;
      changeSummary = dto.changeSummary || 'Fusion automatique';
    }

    const result = await this.pagesRepository.updateWithNewVersion({
      page,
      title,
      content,
      changeSummary,
      authorId,
    });
    this.eventEmitter.emit(
      PAGE_VERSION_CREATED_EVENT,
      new PageVersionCreatedEvent(
        result.page.id,
        result.version.id,
        authorId,
        result.page.title,
        result.version.content,
        changeSummary,
        result.page.updatedAt,
      ),
    );
    if (dto.title !== undefined && dto.title !== page.title) {
      this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
    }
    void this.userActivityLogService.record({
      userId: authorId,
      action: 'page.updated',
      targetType: 'page',
      targetId: id,
      metadata: { changeSummary },
    });
    return { ...result, conflict: false };
  }

  async mergePreview(
    pageId: string,
    baseVersionId: string,
    content: string,
    userId: string,
  ): Promise<PageMergePreviewResponseDto> {
    const page = await this.pagesRepository.findById(pageId);
    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.edit', pageId, userId);

    const baseVersion =
      await this.pagesRepository.findVersionById(baseVersionId);
    if (!baseVersion || baseVersion.pageId !== page.id) {
      throw new VersionNotFoundException();
    }

    const currentVersion = await this.pagesRepository.findVersionById(
      page.currentVersionId,
    );
    if (!currentVersion) {
      throw new PageNotFoundException();
    }

    const merged = this.pageMergeService.merge(
      baseVersion.content,
      content,
      currentVersion.content,
    );

    return {
      conflict: merged.conflict,
      mergedContent: merged.content,
      newBaseVersionId: page.currentVersionId,
    };
  }

  async movePage(
    id: string,
    dto: MovePageDto,
    userId: string,
  ): Promise<{ page: Page; version: PageVersion }> {
    this.validateMovePage(dto);

    const page = await this.pagesRepository.findById(id);
    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.move', id, userId);

    const currentVersion = await this.pagesRepository.findVersionById(
      page.currentVersionId,
    );
    if (!currentVersion) {
      throw new PageNotFoundException();
    }

    const newParentId = dto.newParentId;
    if (newParentId !== null) {
      let currentId: string | null = newParentId;
      while (currentId !== null) {
        if (currentId === id) {
          throw new CircularReferenceException();
        }
        const ancestor: Page | null =
          await this.pagesRepository.findById(currentId);
        if (!ancestor) {
          throw new ParentPageNotFoundException();
        }
        currentId = ancestor.parentId;
      }
    }

    const movingUser = await this.usersService.findById(userId);
    if (newParentId === null) {
      if (
        !(await this.permissionsService.hasGlobal(
          movingUser,
          'page.create_root',
        ))
      ) {
        throw new InsufficientPagePermissionException();
      }
    } else if (
      !(await this.permissionsService.can(
        movingUser,
        'page.create_child',
        newParentId,
      ))
    ) {
      throw new InsufficientPagePermissionException();
    }

    const existing = await this.pagesRepository.findBySlugAndParent(
      page.slug,
      newParentId,
    );
    if (existing && existing.id !== page.id) {
      throw new SlugAlreadyExistsException();
    }

    try {
      const moved = await this.pagesRepository.updateParent(page, newParentId);
      void this.userActivityLogService.record({
        userId,
        action: 'page.moved',
        targetType: 'page',
        targetId: id,
        metadata: { newParentId },
      });
      this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
      return { page: moved, version: currentVersion };
    } catch (error) {
      if (PagesService.isDuplicateSlugError(error)) {
        throw new SlugAlreadyExistsException();
      }
      throw error;
    }
  }

  async deletePage(
    id: string,
    query: DeletePageQueryDto,
    userId: string,
  ): Promise<void> {
    const page = await this.pagesRepository.findById(id);
    if (!page) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.delete', id, userId);

    const cascade = PagesService.parseCascade(query.cascade);
    const children = await this.pagesRepository.findChildren(id);

    if (children.length > 0 && !cascade) {
      throw new PageHasChildrenException();
    }

    if (cascade) {
      const descendantIds = await this.collectDescendantIds(id);
      for (const descendantId of descendantIds) {
        await this.assertCan('page.delete', descendantId, userId);
      }
      await this.deleteRecursive(id);
    } else {
      await this.pagesRepository.softDelete(id);
    }
    void this.userActivityLogService.record({
      userId,
      action: 'page.deleted',
      targetType: 'page',
      targetId: id,
      metadata: { cascade },
    });
    this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
  }

  async setVisibility(
    id: string,
    dto: ChangeVisibilityDto,
    userId: string,
  ): Promise<{ page: Page; version: PageVersion }> {
    this.validateChangeVisibility(dto);

    const page = await this.pagesRepository.findById(id);
    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.manage_visibility', id, userId);

    const version = await this.pagesRepository.findVersionById(
      page.currentVersionId,
    );
    if (!version) {
      throw new PageNotFoundException();
    }

    const wasPublic = page.visibility === 'public';
    const updated = await this.pagesRepository.updateVisibility(
      page,
      dto.visibility,
    );
    await this.cascadeVisibility(id, dto.visibility);

    if (!wasPublic && updated.visibility === 'public') {
      this.eventEmitter.emit(
        PAGE_PUBLISHED_EVENT,
        new PagePublishedEvent(updated.id, updated.slug, updated.title),
      );
    }

    this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);

    void this.userActivityLogService.record({
      userId,
      action: 'page.visibility_changed',
      targetType: 'page',
      targetId: id,
      metadata: { visibility: dto.visibility },
    });

    return { page: updated, version };
  }

  async setCommentsEnabled(
    id: string,
    dto: SetCommentsEnabledDto,
    userId: string,
  ): Promise<{ page: Page; version: PageVersion }> {
    this.validateSetCommentsEnabled(dto);

    const page = await this.pagesRepository.findById(id);
    if (!page || !page.currentVersionId) {
      throw new PageNotFoundException();
    }

    await this.assertCan('page.edit', id, userId);

    const version = await this.pagesRepository.findVersionById(
      page.currentVersionId,
    );
    if (!version) {
      throw new PageNotFoundException();
    }

    const updated = await this.pagesRepository.updateCommentsEnabled(
      page,
      dto.commentsEnabled,
    );

    void this.userActivityLogService.record({
      userId,
      action: 'page.comments_enabled_changed',
      targetType: 'page',
      targetId: id,
      metadata: { commentsEnabled: dto.commentsEnabled },
    });

    return { page: updated, version };
  }

  countCreatedByUser(userId: string): Promise<number> {
    return this.pagesRepository.countCreatedByUser(userId);
  }

  countVersionsByAuthor(userId: string): Promise<number> {
    return this.pagesRepository.countVersionsByAuthor(userId);
  }

  private async cascadeVisibility(
    id: string,
    visibility: Page['visibility'],
  ): Promise<void> {
    const children = await this.pagesRepository.findChildren(id);
    for (const child of children) {
      await this.pagesRepository.updateVisibility(child, visibility);
      await this.cascadeVisibility(child.id, visibility);
    }
  }

  private async assertCan(
    action: PageAction,
    pageId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!(await this.permissionsService.can(user, action, pageId))) {
      throw new InsufficientPagePermissionException();
    }
  }

  private async collectDescendantIds(id: string): Promise<string[]> {
    const children = await this.pagesRepository.findChildren(id);
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...(await this.collectDescendantIds(child.id)));
    }
    return ids;
  }

  private async deleteRecursive(id: string): Promise<void> {
    const children = await this.pagesRepository.findChildren(id);
    for (const child of children) {
      await this.deleteRecursive(child.id);
    }
    await this.pagesRepository.softDelete(id);
  }

  private static parseCascade(raw?: string): boolean {
    return raw === 'true';
  }

  private static isDuplicateSlugError(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as { driverError?: { code?: string } }).driverError?.code ===
        MYSQL_DUPLICATE_ENTRY_CODE
    );
  }

  private async isAccessible(
    page: Page,
    currentUser?: AuthenticatedUser,
  ): Promise<boolean> {
    return this.permissionsService.can(
      await this.resolveFullUser(currentUser),
      'page.read',
      page.id,
    );
  }

  private async assertAccessible(
    page: Page,
    currentUser?: AuthenticatedUser,
  ): Promise<void> {
    if (!(await this.isAccessible(page, currentUser))) {
      throw new PageAccessForbiddenException();
    }
  }

  private async filterAccessible(
    pages: Page[],
    currentUser?: AuthenticatedUser,
  ): Promise<Page[]> {
    return this.permissionsService.filterReadable(
      await this.resolveFullUser(currentUser),
      pages,
    );
  }

  private validateCreatePage(dto: CreatePageDto): void {
    const errors: string[] = [];

    if (!dto.slug || dto.slug.length > SLUG_MAX_LENGTH) {
      errors.push(
        `slug must be longer than or equal to 1 and shorter than or equal to ${SLUG_MAX_LENGTH} characters`,
      );
    } else if (!SLUG_REGEX.test(dto.slug)) {
      errors.push(`slug must match ${SLUG_REGEX}`);
    }

    if (!dto.title || dto.title.length > TITLE_MAX_LENGTH) {
      errors.push(
        `title must be longer than or equal to 1 and shorter than or equal to ${TITLE_MAX_LENGTH} characters`,
      );
    }

    if (typeof dto.content !== 'string') {
      errors.push('content must be a string');
    }

    if (!PAGE_VISIBILITIES.includes(dto.visibility)) {
      errors.push(
        `visibility must be one of the following values: ${PAGE_VISIBILITIES.join(', ')}`,
      );
    }

    if (errors.length > 0) {
      throw new ValidationException(errors.join(', '));
    }
  }

  private validateChangeVisibility(dto: ChangeVisibilityDto): void {
    if (!PAGE_VISIBILITIES.includes(dto.visibility)) {
      throw new ValidationException(
        `visibility must be one of the following values: ${PAGE_VISIBILITIES.join(', ')}`,
      );
    }
  }

  private validateSetCommentsEnabled(dto: SetCommentsEnabledDto): void {
    if (typeof dto.commentsEnabled !== 'boolean') {
      throw new ValidationException('commentsEnabled must be a boolean value');
    }
  }

  private validateMovePage(dto: MovePageDto): void {
    if (
      dto.newParentId !== null &&
      (typeof dto.newParentId !== 'string' || !UUID_REGEX.test(dto.newParentId))
    ) {
      throw new ValidationException('newParentId must be a UUID');
    }
  }

  private validateUpdatePage(dto: UpdatePageDto): void {
    const errors: string[] = [];

    if (
      dto.title !== undefined &&
      (!dto.title || dto.title.length > TITLE_MAX_LENGTH)
    ) {
      errors.push(
        `title must be longer than or equal to 1 and shorter than or equal to ${TITLE_MAX_LENGTH} characters`,
      );
    }

    if (dto.content !== undefined && typeof dto.content !== 'string') {
      errors.push('content must be a string');
    }

    if (
      dto.changeSummary !== undefined &&
      (typeof dto.changeSummary !== 'string' ||
        dto.changeSummary.length > CHANGE_SUMMARY_MAX_LENGTH)
    ) {
      errors.push(
        `changeSummary must be shorter than or equal to ${CHANGE_SUMMARY_MAX_LENGTH} characters`,
      );
    }

    if (errors.length > 0) {
      throw new ValidationException(errors.join(', '));
    }
  }
}
