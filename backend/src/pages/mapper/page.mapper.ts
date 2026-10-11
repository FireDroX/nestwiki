import type { PageAction } from '../../common/permissions.js';
import { ResponseDto } from '../../common/dto/response.dto.js';
import { PageDetailResponseDto } from '../dto/out/page-detail-response.dto.js';
import { PageMergePreviewResponseDto } from '../dto/out/page-merge-preview-response.dto.js';
import { PageResponseDto } from '../dto/out/page-response.dto.js';
import { PageStatsResponseDto } from '../dto/out/page-stats-response.dto.js';
import { PageUpdateResponseDto } from '../dto/out/page-update-response.dto.js';
import { UpdatePageResultDto } from '../dto/out/update-page-result.dto.js';
import { PageVersion } from '../entities/page-version.entity.js';
import { Page } from '../entities/page.entity.js';

export class PageMapper {
  static toPageResponseDto(page: Page, version: PageVersion): PageResponseDto {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      parentId: page.parentId,
      visibility: page.visibility,
      commentsEnabled: page.commentsEnabled,
      currentVersion: {
        id: version.id,
        content: version.content,
      },
      createdAt: page.createdAt,
    };
  }

  static toStatsResponse(
    stats: PageStatsResponseDto,
  ): ResponseDto<PageStatsResponseDto> {
    return new ResponseDto(stats);
  }

  static toResponse(
    page: Page,
    version: PageVersion,
  ): ResponseDto<PageResponseDto> {
    return new ResponseDto(PageMapper.toPageResponseDto(page, version));
  }

  static toPageDetailResponseDto(
    page: Page,
    version: PageVersion,
    isFollowed: boolean,
    permissions: PageAction[],
  ): PageDetailResponseDto {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: version.content,
      visibility: page.visibility,
      commentsEnabled: page.commentsEnabled,
      parentId: page.parentId,
      updatedAt: page.updatedAt,
      isFollowed,
      currentVersionId: page.currentVersionId!,
      permissions,
    };
  }

  static toDetailResponse(
    page: Page,
    version: PageVersion,
    isFollowed: boolean,
    permissions: PageAction[],
  ): ResponseDto<PageDetailResponseDto> {
    return new ResponseDto(
      PageMapper.toPageDetailResponseDto(
        page,
        version,
        isFollowed,
        permissions,
      ),
    );
  }

  static toPageUpdateResponseDto(
    result: UpdatePageResultDto,
  ): PageUpdateResponseDto {
    const { page, version } = result;
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: version.content,
      currentVersionId: page.currentVersionId!,
      updatedAt: page.updatedAt,
      conflict: result.conflict,
      mergedContent: result.mergedContent,
      segments: result.segments,
      currentVersionAuthorName: result.currentVersionAuthorName,
      currentVersionCreatedAt: result.currentVersionCreatedAt,
      currentVersionContent: result.currentVersionContent,
    };
  }

  static toUpdateResponse(
    result: UpdatePageResultDto,
  ): ResponseDto<PageUpdateResponseDto> {
    return new ResponseDto(PageMapper.toPageUpdateResponseDto(result));
  }

  static toMergePreviewResponse(
    result: PageMergePreviewResponseDto,
  ): ResponseDto<PageMergePreviewResponseDto> {
    return new ResponseDto(result);
  }
}
