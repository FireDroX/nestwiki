import { Injectable } from '@nestjs/common';
import { InsufficientPagePermissionException } from '../../common/exceptions/pages/insufficient-page-permission.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { AuthenticatedUser } from '../../common/strategies/jwt.strategy.js';
import { UUID_REGEX } from '../../common/variables.global.js';
import type { Page } from '../../pages/entities/page.entity.js';
import { PagePathIndex } from '../../pages/services/page-path-index.js';
import { PagesService } from '../../pages/services/pages.service.js';
import { PermissionsService } from '../../permissions/services/permissions.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { ImportPreviewDto } from '../dto/in/import-preview.dto.js';
import {
  ImportArchiveReader,
  type UploadedImportFile,
} from './import-archive.reader.js';
import {
  IMPORT_CONFLICT_MODES,
  ImportPlanner,
  type ExistingImportPage,
  type ExistingPagesIndex,
  type ImportConflictMode,
  type ImportDestination,
  type ImportPlacement,
} from './import-planner.js';
import { ImportTreeBuilder, type ImportTree } from './import-tree.builder.js';

export interface ImportPlan {
  tree: ImportTree;
  destination: ImportDestination;
  conflictMode: ImportConflictMode;
  placement: ImportPlacement;
  existingTagNames: string[];
  canCreateTags: boolean;
  canUploadMedia: boolean;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly pagesService: PagesService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
    private readonly tagsService: TagsService,
  ) {}

  async preview(
    file: UploadedImportFile | undefined,
    dto: ImportPreviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<ImportPlan> {
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

    const [canCreateTags, canUploadMedia, tags] = await Promise.all([
      this.permissionsService.hasGlobal(user, 'tag.create'),
      this.permissionsService.hasGlobal(user, 'media.upload'),
      this.tagsService.listTags(),
    ]);

    return {
      tree,
      destination,
      conflictMode,
      placement,
      existingTagNames: tags.map((tag) => tag.name),
      canCreateTags,
      canUploadMedia,
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
}
