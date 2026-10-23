import { ResponseDto } from '../../common/dto/response.dto.js';
import { toComparableName } from '../../common/slug.js';
import type {
  ImportPlanPageDto,
  ImportPlanResponseDto,
} from '../dto/out/import-plan-response.dto.js';
import type { PlannedImportPage } from '../services/import-planner.js';
import type { ImportPlan } from '../services/imports.service.js';

export class ImportMapper {
  static toPlanResponse(plan: ImportPlan): ResponseDto<ImportPlanResponseDto> {
    return new ResponseDto(ImportMapper.toPlanDto(plan));
  }

  static toPlanDto(plan: ImportPlan): ImportPlanResponseDto {
    const { tree, placement } = plan;
    const pathByKey = new Map(
      placement.pages.map((page) => [page.node.key, page.path]),
    );
    const existingTags = new Set(
      plan.existingTagNames.map((name) => toComparableName(name)),
    );
    const usedTags = new Map<string, string>();
    for (const page of placement.pages) {
      for (const tag of page.node.tags) {
        if (!usedTags.has(toComparableName(tag))) {
          usedTags.set(toComparableName(tag), tag);
        }
      }
    }
    const tags = [...usedTags.values()];
    const missingTags = tags.filter(
      (tag) => !existingTags.has(toComparableName(tag)),
    );

    return {
      format: tree.format,
      destination: {
        id: plan.destination.pageId,
        path: plan.destination.path || null,
      },
      conflictMode: plan.conflictMode,
      pageCount: placement.pages.length,
      conflictCount: placement.pages.filter((page) => page.conflict).length,
      pages: ImportMapper.toPageTree(placement.pages),
      media: {
        count: tree.media.length,
        totalSize: tree.media.reduce((total, media) => total + media.size, 0),
      },
      tags: {
        existing: tags.filter((tag) => existingTags.has(toComparableName(tag))),
        missing: missingTags,
      },
      permissions: {
        canCreateTags: plan.canCreateTags,
        canUploadMedia: plan.canUploadMedia,
      },
      warnings: {
        unresolvedLinks: tree.unresolvedLinks.map((link) => ({
          page: pathByKey.get(link.nodeKey) ?? link.nodeKey,
          target: link.target,
        })),
        ignoredFiles: tree.ignoredFiles.map((file) => ({
          file: file.path,
          reason: file.reason,
        })),
        missingTags: plan.canCreateTags ? [] : missingTags,
        mediaWithoutUpload: plan.canUploadMedia ? 0 : tree.media.length,
        renamedSlugs: placement.renamedSlugs.map((renamed) => ({
          page: pathByKey.get(renamed.nodeKey) ?? renamed.nodeKey,
          from: renamed.from,
          to: renamed.to,
          reason: renamed.reason,
        })),
      },
    };
  }

  private static toPageTree(pages: PlannedImportPage[]): ImportPlanPageDto[] {
    const roots: ImportPlanPageDto[] = [];
    const dtoByKey = new Map<string, ImportPlanPageDto>();
    for (const page of pages) {
      const dto: ImportPlanPageDto = {
        path: page.path,
        title: page.node.title,
        slug: page.slug,
        tags: page.node.tags,
        linkCount: page.node.links.filter((link) => link.kind === 'page')
          .length,
        mediaCount: page.node.links.filter((link) => link.kind === 'media')
          .length,
        action: page.action,
        conflict: page.conflict ? { path: page.conflict.path } : null,
        children: [],
      };
      dtoByKey.set(page.node.key, dto);
      const parent = page.node.parentKey
        ? dtoByKey.get(page.node.parentKey)
        : undefined;
      (parent?.children ?? roots).push(dto);
    }
    return roots;
  }
}
