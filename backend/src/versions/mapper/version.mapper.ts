import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto.js';
import { ResponseDto } from '../../common/dto/response.dto.js';
import { PageVersion } from '../../pages/entities/page-version.entity.js';
import type { ContributorInfo } from '../services/versions.service.js';
import { ContributorResponseDto } from '../dto/out/contributor-response.dto.js';
import { VersionDetailResponseDto } from '../dto/out/version-detail-response.dto.js';
import { VersionSummaryResponseDto } from '../dto/out/version-summary-response.dto.js';

export class VersionMapper {
  static toSummaryDto(version: PageVersion): VersionSummaryResponseDto {
    return {
      id: version.id,
      authorId: version.authorId,
      changeSummary: version.changeSummary,
      createdAt: version.createdAt,
    };
  }

  static toDetailDto(version: PageVersion): VersionDetailResponseDto {
    return {
      id: version.id,
      pageId: version.pageId,
      title: version.title,
      content: version.content,
      authorId: version.authorId,
      changeSummary: version.changeSummary,
      createdAt: version.createdAt,
    };
  }

  static toDetailResponse(
    version: PageVersion,
  ): ResponseDto<VersionDetailResponseDto> {
    return new ResponseDto(VersionMapper.toDetailDto(version));
  }

  static toPaginatedResponse(
    items: PageVersion[],
    total: number,
    page: number,
    limit: number,
  ): ResponseDto<PaginatedResponseDto<VersionSummaryResponseDto>> {
    return new ResponseDto({
      items: items.map((item) => VersionMapper.toSummaryDto(item)),
      total,
      page,
      limit,
    });
  }

  static toContributorResponse(
    contributor: ContributorInfo,
  ): ContributorResponseDto {
    return {
      id: contributor.id,
      displayName: contributor.displayName,
      hasAvatar: contributor.hasAvatar,
    };
  }

  static toContributorsResponse(
    contributors: ContributorInfo[],
  ): ResponseDto<ContributorResponseDto[]> {
    return new ResponseDto(
      contributors.map((contributor) =>
        VersionMapper.toContributorResponse(contributor),
      ),
    );
  }
}
