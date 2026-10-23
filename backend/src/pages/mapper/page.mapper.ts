import { ResponseDto } from '../../common/dto/response.dto.js';
import { BrokenPageLinkListDto } from '../dto/out/broken-page-link-response.dto.js';
import { FindByPathResultDto } from '../dto/out/find-by-path-result.dto.js';
import { PageBacklinkDto } from '../dto/out/page-backlink-response.dto.js';
import { PageCreateResponseDto } from '../dto/out/page-create-response.dto.js';
import { PageDetailResponseDto } from '../dto/out/page-detail-response.dto.js';
import { MovedPageLinksDto } from '../dto/out/moved-page-links.dto.js';
import { PageMergePreviewResponseDto } from '../dto/out/page-merge-preview-response.dto.js';
import { PageMoveResponseDto } from '../dto/out/page-move-response.dto.js';
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

  static toCreateResponse(result: {
    page: Page;
    version: PageVersion;
    brokenLinks: string[];
  }): ResponseDto<PageCreateResponseDto> {
    return new ResponseDto({
      ...PageMapper.toPageResponseDto(result.page, result.version),
      brokenLinks: result.brokenLinks,
    });
  }

  static toMoveResponse(result: {
    page: Page;
    version: PageVersion;
    links: MovedPageLinksDto;
  }): ResponseDto<PageMoveResponseDto> {
    return new ResponseDto({
      ...PageMapper.toPageResponseDto(result.page, result.version),
      ...result.links,
    });
  }

  static toBacklinksResponse(
    backlinks: PageBacklinkDto[],
  ): ResponseDto<PageBacklinkDto[]> {
    return new ResponseDto(backlinks);
  }

  static toBrokenLinksResponse(
    list: BrokenPageLinkListDto,
  ): ResponseDto<BrokenPageLinkListDto> {
    return new ResponseDto(list);
  }

  static toPageDetailResponseDto({
    page,
    version,
    isFollowed,
    permissions,
    brokenLinks,
  }: FindByPathResultDto): PageDetailResponseDto {
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
      brokenLinks,
    };
  }

  static toDetailResponse(
    result: FindByPathResultDto,
  ): ResponseDto<PageDetailResponseDto> {
    return new ResponseDto(PageMapper.toPageDetailResponseDto(result));
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
      brokenLinks: result.brokenLinks,
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
