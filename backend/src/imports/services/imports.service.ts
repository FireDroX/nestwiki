import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserActivityLogService } from '../../activity/services/user-activity-log.service.js';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { PageAction } from '../../common/permissions.js';
import { toComparableName } from '../../common/slug.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import {
  DEFAULT_TAG_COLOR,
  UUID_REGEX,
} from '../../common/variables.global.js';
import { MediaService } from '../../media/services/media.service.js';
import {
  PAGE_VISIBILITIES,
  type Page,
  type PageVisibility,
} from '../../pages/entities/page.entity.js';
import { PAGE_TREE_CHANGED_EVENT } from '../../pages/events/page-tree-changed.event.js';
import {
  PAGES_IMPORTED_EVENT,
  PagesImportedEvent,
} from '../../pages/events/pages-imported.event.js';
import { PagePathIndex } from '../../pages/services/page-path-index.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import type { Tag } from '../../tags/entities/tag.entity.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { ImportExecuteDto } from '../dto/in/import-execute.dto.js';
import { ImportPreviewDto } from '../dto/in/import-preview.dto.js';
import type {
  ImportedAttachmentInput,
  ImportedPageInput,
  ImportedTagInput,
  ImportedVersionInput,
  ImportsRepository,
} from '../persistence/import.repository.js';
import {
  ImportArchiveReader,
  type UploadedImportFile,
} from './import-archive.reader.js';
import { ImportMarkdownConverter } from './import-markdown.converter.js';
import {
  IMPORT_CONFLICT_MODES,
  ImportPlanner,
  type ExistingImportPage,
  type ExistingPagesIndex,
  type ImportConflictMode,
  type ImportDestination,
  type ImportPlacement,
  type PlannedImportPage,
} from './import-planner.js';
import {
  ImportTreeBuilder,
  type ImportMediaFile,
  type ImportTree,
} from './import-tree.builder.js';

export interface ImportPlan {
  tree: ImportTree;
  destination: ImportDestination;
  conflictMode: ImportConflictMode;
  placement: ImportPlacement;
  existingTags: Tag[];
  canCreateTags: boolean;
  canUploadMedia: boolean;
}

export type ImportSkipReason = 'exists' | 'forbidden';

export interface ImportPageOutcome {
  planned: PlannedImportPage;
  action: 'create' | 'update' | 'skip';
  skipReason: ImportSkipReason | null;
  pageId: string | null;
  versionId: string | null;
}

export interface ImportResult {
  plan: ImportPlan;
  outcomes: ImportPageOutcome[];
  uploadedMediaCount: number;
  createdTags: string[];
  skippedTags: string[];
  rootPageId: string | null;
  rootPath: string | null;
}

type PageActionCheck = (action: PageAction, pageId: string) => boolean;

const IMPORT_CHANGE_SUMMARY = 'Import';

@Injectable()
export class ImportsService {
  constructor(
    private readonly pagesService: PagesService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
    private readonly tagsService: TagsService,
    private readonly mediaService: MediaService,
    private readonly userActivityLogService: UserActivityLogService,
    private readonly eventEmitter: EventEmitter2,
    @Inject('ImportsRepository')
    private readonly importsRepository: ImportsRepository,
  ) {}

  async preview(
    file: UploadedImportFile | undefined,
    dto: ImportPreviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<ImportPlan> {
    return (await this.buildPlan(file, dto, currentUser)).plan;
  }

  async execute(
    file: UploadedImportFile | undefined,
    dto: ImportExecuteDto,
    currentUser: AuthenticatedUser,
  ): Promise<ImportResult> {
    const visibility = ImportsService.parseVisibility(dto.visibility);
    const createMissingTags = ImportsService.parseBoolean(
      dto.createMissingTags,
      'createMissingTags',
    );
    const { plan, user } = await this.buildPlan(file, dto, currentUser);
    const can = await this.existingPageActions(plan, user);
    const outcomes = ImportsService.authorizePages(plan, can);
    const written = outcomes.filter(
      (outcome) => outcome.action !== 'skip',
    ) as (ImportPageOutcome & { pageId: string; versionId: string })[];
    const outcomeByKey = new Map(
      outcomes.map((outcome) => [outcome.planned.node.key, outcome]),
    );

    const media = plan.canUploadMedia
      ? ImportsService.mediaOwners(plan.tree.media, written)
      : [];
    const uploadedKeys: string[] = [];
    try {
      const attachments: ImportedAttachmentInput[] = [];
      for (const { file: mediaFile, ownerPageId } of media) {
        const minioKey = await this.mediaService.storeImportedFile({
          pageId: ownerPageId,
          filename: mediaFile.filename,
          mimeType: mediaFile.mimeType,
          data: mediaFile.data,
        });
        uploadedKeys.push(minioKey);
        attachments.push({
          id: randomUUID(),
          pageId: ownerPageId,
          minioKey,
          filename: mediaFile.filename,
          mimeType: mediaFile.mimeType,
          size: mediaFile.size,
        });
      }

      const attachmentIdByPath = new Map(
        media.map(({ file: mediaFile }, index) => [
          mediaFile.path,
          attachments[index].id,
        ]),
      );
      const contentOf = (outcome: ImportPageOutcome): string =>
        ImportMarkdownConverter.render(
          outcome.planned.node.body,
          outcome.planned.node.links,
          {
            pagePath: (nodeKey) =>
              outcomeByKey.get(nodeKey)?.planned.path ?? '',
            mediaUrl: (path, original) => {
              const id = attachmentIdByPath.get(path);
              return id ? `/api/media/${id}/raw` : original;
            },
          },
        );

      const createdPages: ImportedPageInput[] = [];
      const updatedPages: ImportedVersionInput[] = [];
      for (const outcome of written) {
        const { planned } = outcome;
        if (outcome.action === 'create') {
          const parent = planned.node.parentKey
            ? outcomeByKey.get(planned.node.parentKey)!.pageId
            : plan.destination.pageId;
          createdPages.push({
            id: outcome.pageId,
            versionId: outcome.versionId,
            parentId: parent,
            slug: planned.slug,
            title: planned.node.title,
            content: contentOf(outcome),
            visibility,
          });
        } else {
          updatedPages.push({
            pageId: outcome.pageId,
            versionId: outcome.versionId,
            title: planned.node.title,
            content: contentOf(outcome),
          });
        }
      }

      const tagging = ImportsService.planTags(
        plan,
        written,
        createMissingTags,
        can,
      );

      await this.importsRepository.write({
        authorId: user.id,
        changeSummary: IMPORT_CHANGE_SUMMARY,
        createdPages,
        updatedPages,
        attachments,
        tags: tagging.tags,
        pageTags: tagging.pageTags,
      });

      await this.pagesService.indexImportedPages([
        ...createdPages.map((page) => ({
          pageId: page.id,
          versionId: page.versionId,
          content: page.content,
        })),
        ...updatedPages,
      ]);

      const root = ImportsService.importRoot(plan, outcomes);
      const result: ImportResult = {
        plan,
        outcomes,
        uploadedMediaCount: attachments.length,
        createdTags: tagging.tags.map((tag) => tag.name),
        skippedTags: tagging.skippedTags,
        rootPageId: root.pageId,
        rootPath: root.path,
      };
      this.announce(result, createdPages.length, updatedPages.length, user);
      return result;
    } catch (error) {
      await this.mediaService.discardImportedFiles(uploadedKeys);
      throw error;
    }
  }

  private async buildPlan(
    file: UploadedImportFile | undefined,
    dto: ImportPreviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ plan: ImportPlan; user: User }> {
    const parentId = ImportsService.parseParentId(dto.parentId);
    const conflictMode = ImportsService.parseConflictMode(dto.conflict);
    const user = await this.usersService.findById(currentUser.id);
    await this.assertCanImportInto(parentId, user, currentUser);

    const tree = ImportTreeBuilder.build(await ImportArchiveReader.read(file));
    const pages = await this.pagesService.listAllPages();
    const paths = new PagePathIndex(pages);
    const destinationPath = parentId ? (paths.pathOf(parentId) ?? '') : '';
    const destination: ImportDestination = {
      pageId: parentId,
      path: destinationPath,
      depth: destinationPath.split('/').length - 1,
    };
    const placement = ImportPlanner.place(
      tree,
      destination,
      ImportsService.existingPagesIndex(pages, paths),
      conflictMode,
    );

    const [canCreateTags, canUploadMedia, existingTags] = await Promise.all([
      this.permissionsService.hasGlobal(user, 'tag.create'),
      this.permissionsService.hasGlobal(user, 'media.upload'),
      this.tagsService.listTags(),
    ]);

    return {
      plan: {
        tree,
        destination,
        conflictMode,
        placement,
        existingTags,
        canCreateTags,
        canUploadMedia,
      },
      user,
    };
  }

  private async assertCanImportInto(
    parentId: string | null,
    user: User,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (parentId === null) {
      if (
        !(await this.permissionsService.hasGlobal(user, 'page.create_root'))
      ) {
        throw new InsufficientPagePermissionException();
      }
      return;
    }
    await this.pagesService.getByIdOrFail(parentId, currentUser);
    if (
      !(await this.permissionsService.can(user, 'page.create_child', parentId))
    ) {
      throw new InsufficientPagePermissionException();
    }
  }

  private async existingPageActions(
    plan: ImportPlan,
    user: User,
  ): Promise<PageActionCheck> {
    const existingIds = [
      ...new Set(
        plan.placement.pages.flatMap((page) =>
          page.conflict ? [page.conflict.id] : [],
        ),
      ),
    ];
    const actions = await this.permissionsService.getEffectivePageActionsBulk(
      user,
      existingIds,
    );
    return (action, pageId) => actions.get(pageId)?.includes(action) ?? false;
  }

  private static authorizePages(
    plan: ImportPlan,
    can: PageActionCheck,
  ): ImportPageOutcome[] {
    const outcomes = new Map<string, ImportPageOutcome>();
    for (const planned of plan.placement.pages) {
      const parent = planned.node.parentKey
        ? outcomes.get(planned.node.parentKey)!
        : null;
      const skip = (
        reason: ImportSkipReason,
        pageId: string | null,
      ): ImportPageOutcome => ({
        planned,
        action: 'skip',
        skipReason: reason,
        pageId,
        versionId: null,
      });

      let outcome: ImportPageOutcome;
      if (planned.action === 'skip') {
        outcome = skip('exists', planned.conflict!.id);
      } else if (planned.action === 'update') {
        outcome = can('page.edit', planned.conflict!.id)
          ? {
              planned,
              action: 'update',
              skipReason: null,
              pageId: planned.conflict!.id,
              versionId: randomUUID(),
            }
          : skip('forbidden', planned.conflict!.id);
      } else if (parent && parent.pageId === null) {
        outcome = skip('forbidden', null);
      } else if (
        parent &&
        parent.action !== 'create' &&
        !can('page.create_child', parent.pageId!)
      ) {
        outcome = skip('forbidden', null);
      } else {
        outcome = {
          planned,
          action: 'create',
          skipReason: null,
          pageId: randomUUID(),
          versionId: randomUUID(),
        };
      }
      outcomes.set(planned.node.key, outcome);
    }
    return [...outcomes.values()];
  }

  private static planTags(
    plan: ImportPlan,
    written: (ImportPageOutcome & { pageId: string })[],
    createMissingTags: boolean,
    can: PageActionCheck,
  ): {
    tags: ImportedTagInput[];
    pageTags: { pageId: string; tagId: string }[];
    skippedTags: string[];
  } {
    const tagIdByName = new Map(
      plan.existingTags.map((tag) => [toComparableName(tag.name), tag.id]),
    );
    const canCreate = createMissingTags && plan.canCreateTags;
    const tags: ImportedTagInput[] = [];
    const skippedTags = new Map<string, string>();
    const pageTags: { pageId: string; tagId: string }[] = [];

    for (const outcome of written) {
      if (
        outcome.action === 'update' &&
        !can('page.manage_tags', outcome.pageId)
      ) {
        continue;
      }
      for (const name of outcome.planned.node.tags) {
        const nameKey = toComparableName(name);
        let tagId = tagIdByName.get(nameKey);
        if (!tagId && canCreate) {
          tagId = randomUUID();
          tagIdByName.set(nameKey, tagId);
          tags.push({ id: tagId, name, color: DEFAULT_TAG_COLOR });
        }
        if (tagId) {
          pageTags.push({ pageId: outcome.pageId, tagId });
        } else if (!skippedTags.has(nameKey)) {
          skippedTags.set(nameKey, name);
        }
      }
    }
    return { tags, pageTags, skippedTags: [...skippedTags.values()] };
  }

  private announce(
    result: ImportResult,
    createdCount: number,
    updatedCount: number,
    user: User,
  ): void {
    const skippedCount = result.outcomes.length - createdCount - updatedCount;
    void this.userActivityLogService.record({
      userId: user.id,
      action: 'page.imported',
      targetType: 'page',
      targetId: result.rootPageId ?? undefined,
      metadata: {
        destination: result.plan.destination.path || '/',
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        media: result.uploadedMediaCount,
        tagsCreated: result.createdTags.length,
      },
    });
    if (createdCount + updatedCount === 0) {
      return;
    }
    this.eventEmitter.emit(PAGE_TREE_CHANGED_EVENT);
    this.eventEmitter.emit(
      PAGES_IMPORTED_EVENT,
      new PagesImportedEvent(
        user.id,
        createdCount,
        updatedCount,
        result.rootPageId,
      ),
    );
  }

  private static mediaOwners(
    media: ImportMediaFile[],
    written: (ImportPageOutcome & { pageId: string })[],
  ): { file: ImportMediaFile; ownerPageId: string }[] {
    const ownerByPath = new Map<string, string>();
    for (const outcome of written) {
      for (const link of outcome.planned.node.links) {
        if (link.kind === 'media' && !ownerByPath.has(link.path)) {
          ownerByPath.set(link.path, outcome.pageId);
        }
      }
    }
    return media.flatMap((file) => {
      const ownerPageId = ownerByPath.get(file.path);
      return ownerPageId ? [{ file, ownerPageId }] : [];
    });
  }

  private static importRoot(
    plan: ImportPlan,
    outcomes: ImportPageOutcome[],
  ): { pageId: string | null; path: string | null } {
    const topLevel = outcomes.filter(
      (outcome) => outcome.planned.node.parentKey === null,
    );
    if (topLevel.length === 1 && topLevel[0].pageId) {
      return { pageId: topLevel[0].pageId, path: topLevel[0].planned.path };
    }
    return {
      pageId: plan.destination.pageId,
      path: plan.destination.path || null,
    };
  }

  private static existingPagesIndex(
    pages: Page[],
    paths: PagePathIndex,
  ): ExistingPagesIndex {
    const childrenByParent = new Map<
      string | null,
      Map<string, ExistingImportPage>
    >();
    for (const page of pages) {
      const path = paths.pathOf(page.id);
      if (!path) {
        continue;
      }
      const children =
        childrenByParent.get(page.parentId) ??
        new Map<string, ExistingImportPage>();
      children.set(page.slug, { id: page.id, path });
      childrenByParent.set(page.parentId, children);
    }
    return {
      childrenOf: (parentId) =>
        childrenByParent.get(parentId) ?? new Map<string, ExistingImportPage>(),
    };
  }

  private static parseParentId(raw: string | undefined): string | null {
    if (raw === undefined || raw === '' || raw === 'null') {
      return null;
    }
    if (!UUID_REGEX.test(raw)) {
      throw new ValidationException('parentId must be a UUID');
    }
    return raw;
  }

  private static parseConflictMode(
    raw: string | undefined,
  ): ImportConflictMode {
    const mode = raw ?? 'skip';
    if (!(IMPORT_CONFLICT_MODES as readonly string[]).includes(mode)) {
      throw new ValidationException(
        `conflict must be one of the following values: ${IMPORT_CONFLICT_MODES.join(', ')}`,
      );
    }
    return mode as ImportConflictMode;
  }

  private static parseVisibility(raw: string | undefined): PageVisibility {
    const visibility = raw ?? 'private';
    if (!(PAGE_VISIBILITIES as readonly string[]).includes(visibility)) {
      throw new ValidationException(
        `visibility must be one of the following values: ${PAGE_VISIBILITIES.join(', ')}`,
      );
    }
    return visibility as PageVisibility;
  }

  private static parseBoolean(
    raw: string | boolean | undefined,
    field: string,
  ): boolean {
    if (raw === undefined || raw === '' || raw === false || raw === 'false') {
      return false;
    }
    if (raw === true || raw === 'true') {
      return true;
    }
    throw new ValidationException(`${field} must be a boolean value`);
  }
}
