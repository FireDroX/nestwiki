import { ResponseDto } from '../../common/dto/response.dto.js';
import type {
  AccessRuleResponseDto,
  PageAccessRuleResponseDto,
} from '../dto/out/access-rule-response.dto.js';
import type {
  AccessRuleView,
  PageAccessRuleView,
} from '../services/access-rules.service.js';

export class AccessRuleMapper {
  static toResponseDto(rule: AccessRuleView): AccessRuleResponseDto {
    return {
      id: rule.id,
      pageId: rule.pageId,
      appliesTo: rule.appliesTo,
      actions: rule.actions,
      excludedPageIds: rule.excludedPageIds,
      grantedById: rule.grantedById,
      createdAt: rule.createdAt,
    };
  }

  static toResponse(rule: AccessRuleView): ResponseDto<AccessRuleResponseDto> {
    return new ResponseDto(AccessRuleMapper.toResponseDto(rule));
  }

  static toListResponse(
    rules: AccessRuleView[],
  ): ResponseDto<AccessRuleResponseDto[]> {
    return new ResponseDto(
      rules.map((rule) => AccessRuleMapper.toResponseDto(rule)),
    );
  }

  static toPageResponseDto(
    rule: PageAccessRuleView,
  ): PageAccessRuleResponseDto {
    return {
      ...AccessRuleMapper.toResponseDto(rule),
      inherited: rule.inherited,
      subject: rule.subject,
    };
  }

  static toPageListResponse(
    rules: PageAccessRuleView[],
  ): ResponseDto<PageAccessRuleResponseDto[]> {
    return new ResponseDto(
      rules.map((rule) => AccessRuleMapper.toPageResponseDto(rule)),
    );
  }
}
